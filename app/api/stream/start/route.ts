import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";

export const runtime = "nodejs";

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}

function livekitToken(apiKey: string, apiSecret: string) {
  const header = base64url(JSON.stringify({alg:"HS256",typ:"JWT"}));
  const now = Math.floor(Date.now()/1000);
  const payload = base64url(JSON.stringify({
    iss: apiKey,
    sub: "chemchem-broadcast-engine",
    nbf: now - 5,
    exp: now + 300,
    video: { roomRecord: true }
  }));
  const data = header+"."+payload;
  const sig = createHmac("sha256", apiSecret).update(data).digest();
  return data+"."+base64url(sig);
}

function hostFromLivekit(url: string) {
  return url.replace(/^wss:\/\//i,"https://").replace(/^ws:\/\//i,"http://").replace(/\/$/,"");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const server = String(body.server || "").trim();
    const key = String(body.key || "").trim();
    const sourceUrl = String(body.sourceUrl || "").trim();
    const name = String(body.name || "CHEMCHEM TV KENYA — PROGRAM").trim();
    const resolution = String(body.resolution || "1920x1080");

    const lkUrl = process.env.LIVEKIT_URL || "";
    const apiKey = process.env.LIVEKIT_API_KEY || "";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "";
    if (!lkUrl || !apiKey || !apiSecret) {
      return NextResponse.json({ok:false,error:"LiveKit is not configured on the server. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Vercel."},{status:503});
    }
    if (!server || !key) return NextResponse.json({ok:false,error:"Facebook Server URL and Stream Key are required."},{status:400});
    if (!/^rtmps?:\/\//i.test(server)) return NextResponse.json({ok:false,error:"Invalid Facebook RTMP(S) server URL."},{status:400});
    if (!/^https?:\/\//i.test(sourceUrl)) return NextResponse.json({ok:false,error:"Program media must be a public HTTPS URL. Upload the media to Cloud Media first."},{status:400});

    const cleanServer = server.replace(/\/$/,"");
    const facebookUrl = cleanServer + "/" + key.replace(/^\/+/, "");
    const base = process.env.APP_BASE_URL || req.nextUrl.origin;
    const outputUrl = base + "/output?src=" + encodeURIComponent(sourceUrl) + "&kind=PROGRAM&name=" + encodeURIComponent(name);

    const token = livekitToken(apiKey, apiSecret);
    const endpoint = hostFromLivekit(lkUrl) + "/twirp/livekit.Egress/StartEgress";
    const preset = resolution === "1280x720" ? "H264_720P_30" : "H264_1080P_30";
    const egressRequest = {
      web: { url: outputUrl, await_start_signal: true },
      preset,
      outputs: [{ stream: { protocol: "RTMP", urls: [facebookUrl] } }]
    };

    const response = await fetch(endpoint,{
      method:"POST",
      headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify(egressRequest),
      cache:"no-store"
    });
    const text = await response.text();
    let data:any;
    try { data = JSON.parse(text); } catch { data = {raw:text}; }
    if (!response.ok) {
      return NextResponse.json({ok:false,error:data?.message || data?.error || "LiveKit rejected the egress request.",details:data},{status:502});
    }
    return NextResponse.json({
      ok:true,
      egressId:data.egress_id || data.egressId,
      status:data.status,
      outputUrl,
      destination:"FACEBOOK RTMPS",
      message:"Facebook egress started. Verify the incoming preview in Facebook Live Producer."
    });
  } catch (error:any) {
    return NextResponse.json({ok:false,error:error?.message || "Unable to start Facebook stream."},{status:500});
  }
}
