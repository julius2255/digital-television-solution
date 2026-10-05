import { NextRequest, NextResponse } from "next/server";
import { createEgressApiToken, livekitHttpUrl } from "../../../lib/livekit";

export const runtime = "nodejs";

function streamStatusName(value: unknown) {
  if (typeof value === "number") return ["ACTIVE", "FINISHED", "FAILED"][value] || String(value);
  return String(value || "");
}

function egressStatusName(value: unknown) {
  if (typeof value === "number") return ["EGRESS_STARTING","EGRESS_ACTIVE","EGRESS_ENDING","EGRESS_COMPLETE","EGRESS_FAILED","EGRESS_ABORTED","EGRESS_LIMIT_REACHED"][value] || String(value);
  return String(value || "");
}

export async function GET(req: NextRequest) {
  try {
    const egressId = req.nextUrl.searchParams.get("egressId")?.trim() || "";
    if (!egressId) return NextResponse.json({ ok: false, error: "Missing egressId." }, { status: 400 });

    const u = process.env.LIVEKIT_URL || "";
    const k = process.env.LIVEKIT_API_KEY || "";
    const s = process.env.LIVEKIT_API_SECRET || "";
    if (!u || !k || !s) return NextResponse.json({ ok: false, error: "LiveKit is not configured on the server." }, { status: 503 });

    const authToken = createEgressApiToken(k, s, "chemchem-status-" + Date.now());
    const r = await fetch(livekitHttpUrl(u) + "/twirp/livekit.Egress/ListEgress", {
      method: "POST",
      headers: { Authorization: "Bearer " + authToken, "Content-Type": "application/json" },
      body: JSON.stringify({ egress_id: egressId }),
      cache: "no-store"
    });

    const t = await r.text();
    let d: any;
    try { d = JSON.parse(t); } catch { d = { raw: t }; }
    if (!r.ok) return NextResponse.json({ ok: false, error: d?.message || d?.error || "LiveKit status request failed.", details: d }, { status: 502 });

    const info = Array.isArray(d.items) ? d.items[0] : d;
    const stream = Array.isArray(info?.stream_results) ? info.stream_results[0] : undefined;

    const request = info?.request || {};
    const advanced = request?.advanced || {};
    const preset = request?.preset;
    return NextResponse.json({
      ok: true,
      egressId: info?.egress_id || egressId,
      status: egressStatusName(info?.status),
      error: info?.error || null,
      sourceType: info?.source_type ?? null,
      streamStatus: streamStatusName(stream?.status),
      streamError: stream?.error || null,
      startedAt: stream?.started_at ?? info?.started_at ?? null,
      endedAt: stream?.ended_at ?? info?.ended_at ?? null,
      duration: stream?.duration ?? null,
      retries: stream?.retries ?? null,
      lastRetryAt: stream?.last_retry_at ?? null,
      encoder: {
        width: advanced.width ?? null,
        height: advanced.height ?? null,
        framerate: advanced.framerate ?? null,
        videoBitrateKbps: advanced.videoBitrate ?? advanced.video_bitrate ?? null,
        audioBitrateKbps: advanced.audioBitrate ?? advanced.audio_bitrate ?? null,
        videoCodec: advanced.videoCodec ?? advanced.video_codec ?? null,
        audioCodec: advanced.audioCodec ?? advanced.audio_codec ?? null,
        preset: preset ?? null
      },
      deliveredBitrateKbps: null,
      deliveredBitrateAvailable: false
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to inspect Facebook stream." }, { status: 500 });
  }
}
