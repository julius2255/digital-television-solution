import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createLiveKitToken, LIVEKIT_ROOM } from "../../../lib/livekit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const requestedRole = req.nextUrl.searchParams.get("role");
    const role = requestedRole === "director" ? "director" : requestedRole === "connector" ? "connector" : "viewer";
    const url = process.env.LIVEKIT_URL || "";
    const apiKey = process.env.LIVEKIT_API_KEY || "";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "";

    if (!url || !apiKey || !apiSecret) {
      return NextResponse.json({ ok: false, error: "LiveKit is not configured on the server." }, { status: 503 });
    }

    const identity = (role === "director" ? "chemchem-director-" : "chemchem-viewer-") + randomUUID();
    const token = createLiveKitToken(apiKey, apiSecret, identity, role);

    return NextResponse.json({ ok: true, url, roomName: LIVEKIT_ROOM, identity, role, token });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to create LiveKit token." }, { status: 500 });
  }
}
