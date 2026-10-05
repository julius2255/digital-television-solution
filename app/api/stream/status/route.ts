import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";

export const runtime = "nodejs";

function b64(v: string | Buffer) {
  return Buffer.from(v).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function token(key: string, secret: string) {
  const h = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const p = b64(JSON.stringify({
    iss: key,
    sub: "chemchem-broadcast-engine",
    nbf: now - 5,
    exp: now + 300,
    video: { roomRecord: true }
  }));
  const d = h + "." + p;
  return d + "." + b64(createHmac("sha256", secret).update(d).digest());
}

function host(u: string) {
  return u.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://").replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  try {
    const egressId = req.nextUrl.searchParams.get("egressId")?.trim() || "";
    if (!egressId) return NextResponse.json({ ok: false, error: "Missing egressId." }, { status: 400 });

    const u = process.env.LIVEKIT_URL || "";
    const k = process.env.LIVEKIT_API_KEY || "";
    const s = process.env.LIVEKIT_API_SECRET || "";
    if (!u || !k || !s) return NextResponse.json({ ok: false, error: "LiveKit is not configured on the server." }, { status: 503 });

    const r = await fetch(host(u) + "/twirp/livekit.Egress/ListEgress", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token(k, s),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ egress_id: egressId }),
      cache: "no-store"
    });

    const t = await r.text();
    let d: any;
    try { d = JSON.parse(t); } catch { d = { raw: t }; }

    if (!r.ok) {
      return NextResponse.json({
        ok: false,
        error: d?.message || d?.error || "LiveKit status request failed.",
        details: d
      }, { status: 502 });
    }

    const info = Array.isArray(d.items) ? d.items[0] : d;
    const stream = Array.isArray(info?.stream_results) ? info.stream_results[0] : undefined;

    return NextResponse.json({
      ok: true,
      egressId: info?.egress_id || egressId,
      status: info?.status,
      error: info?.error || null,
      streamStatus: stream?.status ?? null,
      streamError: stream?.error || null,
      startedAt: stream?.started_at ?? null,
      endedAt: stream?.ended_at ?? null,
      duration: stream?.duration ?? null,
      retries: stream?.retries ?? null
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unable to inspect Facebook stream." }, { status: 500 });
  }
}
