import { createHmac } from "node:crypto";

export const LIVEKIT_ROOM = "chemchem-program";

export function livekitHttpUrl(url: string) {
  return url.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://").replace(/\/$/, "");
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function sign(apiKey: string, apiSecret: string, identity: string, video: Record<string, unknown>) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: identity,
    nbf: now - 5,
    exp: now + 24 * 60 * 60,
    video
  };
  const data = header + "." + base64url(JSON.stringify(payload));
  return data + "." + base64url(createHmac("sha256", apiSecret).update(data).digest());
}

export function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  identity: string,
  role: "director" | "viewer"
) {
  return sign(apiKey, apiSecret, identity, {
    room: LIVEKIT_ROOM,
    roomJoin: true,
    canPublish: role === "director",
    canSubscribe: true,
    canPublishData: true
  });
}

export function createEgressApiToken(apiKey: string, apiSecret: string, identity: string) {
  return sign(apiKey, apiSecret, identity, { roomRecord: true });
}
