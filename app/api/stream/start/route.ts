import { NextRequest, NextResponse } from "next/server";
import { createEgressApiToken, livekitHttpUrl } from "../../../lib/livekit";
import { randomUUID } from "node:crypto";

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
      return NextResponse.json({ ok: false, error: "LiveKit is not configured on the server. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Vercel." }, { status: 503 });
    }
    if (!server || !key) {
      return NextResponse.json({ ok: false, error: "Facebook Server URL and Stream Key are required." }, { status: 400 });
    }
    if (!/^rtmps?:\/\//i.test(server)) {
      return NextResponse.json({ ok: false, error: "Invalid Facebook RTMP(S) server URL." }, { status: 400 });
    }

    const facebookUrl = server.replace(/\/$/, "") + "/" + key.replace(/^\/+/, "");
    const base = process.env.APP_BASE_URL || req.nextUrl.origin;
    const outputUrl = base + "/output?name=" + encodeURIComponent(name);

    const identity = "chemchem-egress-api-" + randomUUID();
    const authToken = createEgressApiToken(apiKey, apiSecret, identity);
    const endpoint = livekitHttpUrl(lkUrl) + "/twirp/livekit.Egress/StartEgress";
    const preset = resolution === "1280x720" ? "H264_720P_30" : "H264_1080P_30";

    const egressRequest = {
      web: {
        url: outputUrl,
        await_start_signal: false
      },
      preset,
      outputs: [
        {
          stream: {
            protocol: "RTMP",
            urls: [facebookUrl]
          }
        }
      ]
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + authToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(egressRequest),
      cache: "no-store"
    });

    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) {
      return NextResponse.json({ ok: false, error: data?.message || data?.error || "LiveKit rejected the egress request.", details: data }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      egressId: data.egress_id || data.egressId,
      status: data.status,
      outputUrl,
      destination: "FACEBOOK RTMPS",
      message: "Facebook cloud egress started from the Program / LIVE OUTPUT composition."
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to start Facebook stream." }, { status: 500 });
  }
}
