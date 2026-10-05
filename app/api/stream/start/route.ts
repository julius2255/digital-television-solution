import { NextRequest, NextResponse } from "next/server";
import { livekitHttpUrl } from "../../../lib/livekit";
import {
  EgressClient,
  StreamOutput,
  StreamProtocol,
  EncodingOptions,
  AudioCodec,
  VideoCodec
} from "livekit-server-sdk";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const server = String(body.server || "").trim();
    const key = String(body.key || "").trim();
    const name = String(body.name || "CHEMCHEM TV KENYA — PROGRAM").trim();
    const resolution = String(body.resolution || "1920x1080");

    const lkUrl = process.env.LIVEKIT_URL || "";
    const apiKey = process.env.LIVEKIT_API_KEY || "";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "";

    if (!lkUrl || !apiKey || !apiSecret) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "LiveKit is not configured on the server. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Vercel."
        },
        { status: 503 }
      );
    }

    if (!server || !key) {
      return NextResponse.json(
        { ok: false, error: "Facebook Server URL and Stream Key are required." },
        { status: 400 }
      );
    }

    if (!/^rtmps?:\/\//i.test(server)) {
      return NextResponse.json(
        { ok: false, error: "Invalid Facebook RTMP(S) server URL." },
        { status: 400 }
      );
    }

    const facebookUrl =
      server.replace(/\/$/, "") + "/" + key.replace(/^\/+/, "");
    const base = process.env.APP_BASE_URL || req.nextUrl.origin;
    const outputUrl =
      base + "/output?name=" + encodeURIComponent(name);

    if (!/^https?:\/\//i.test(outputUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Program Output URL is not publicly reachable over HTTP/HTTPS. Set APP_BASE_URL to the public Vercel URL."
        },
        { status: 500 }
      );
    }

    const [width, height] = resolution.split("x").map(Number);
    const safeWidth = Number.isFinite(width) ? width : 1920;
    const safeHeight = Number.isFinite(height) ? height : 1080;
    const safeFps = Math.max(
      15,
      Math.min(60, Number(body.fps) || 30)
    );
    const safeBitrate = Math.max(
      1500,
      Math.min(9000, Number(body.bitrate) || 4500)
    );

    // Use the official LiveKit Server SDK so the request is serialized
    // exactly as LiveKit expects. The web egress captures /output, which
    // is the authoritative CHEMCHEM Program / Live Output.
    const egressClient = new EgressClient(
      livekitHttpUrl(lkUrl),
      apiKey,
      apiSecret
    );

    const streamOutput = new StreamOutput({
      protocol: StreamProtocol.RTMP,
      urls: [facebookUrl]
    });

    const encodingOptions = new EncodingOptions({
      width: safeWidth,
      height: safeHeight,
      framerate: safeFps,
      audioCodec: AudioCodec.AAC,
      audioBitrate: 128,
      videoCodec: VideoCodec.H264_HIGH,
      videoBitrate: safeBitrate,
      keyFrameInterval: 2
    });

    let info: any;
    try {
      info = await egressClient.startWebEgress(
        outputUrl,
        streamOutput,
        {
          awaitStartSignal: false,
          encodingOptions
        }
      );
    } catch (error: any) {
      const detail =
        error?.response?.data ||
        error?.response ||
        error?.details ||
        error?.message ||
        "Unknown LiveKit Egress error";

      const detailText =
        typeof detail === "string" ? detail : JSON.stringify(detail);

      return NextResponse.json(
        {
          ok: false,
          error: "LiveKit Egress start failed: " + detailText,
          outputUrl,
          destination: "FACEBOOK RTMPS"
        },
        { status: 502 }
      );
    }

    const egressId = info?.egressId || info?.egress_id || "";
    if (!egressId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "LiveKit accepted the Egress request but returned no Egress ID.",
          details: info
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      egressId,
      status: info?.status,
      outputUrl,
      encoder: {
        width: safeWidth,
        height: safeHeight,
        framerate: safeFps,
        videoBitrateKbps: safeBitrate,
        audioBitrateKbps: 128,
        videoCodec: "H264_HIGH",
        audioCodec: "AAC"
      },
      destination: "FACEBOOK RTMPS",
      message:
        "Facebook cloud egress started from the Program / LIVE OUTPUT composition."
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unable to start Facebook stream."
      },
      { status: 500 }
    );
  }
}
