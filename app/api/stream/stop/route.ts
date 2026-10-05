import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";

export const runtime = "nodejs";

function b64(v:string|Buffer){return Buffer.from(v).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");}
function token(key:string,secret:string){
  const h=b64(JSON.stringify({alg:"HS256",typ:"JWT"}));
  const now=Math.floor(Date.now()/1000);
  const p=b64(JSON.stringify({iss:key,sub:"chemchem-broadcast-engine",nbf:now-5,exp:now+300,video:{roomRecord:true}}));
  const d=h+"."+p;
  return d+"."+b64(createHmac("sha256",secret).update(d).digest());
}
function host(u:string){return u.replace(/^wss:\/\//i,"https://").replace(/^ws:\/\//i,"http://").replace(/\/$/,"");}

export async function POST(req:NextRequest){
  try{
    const {egressId}=await req.json();
    if(!egressId)return NextResponse.json({ok:false,error:"Missing egressId."},{status:400});
    const u=process.env.LIVEKIT_URL||"",k=process.env.LIVEKIT_API_KEY||"",s=process.env.LIVEKIT_API_SECRET||"";
    if(!u||!k||!s)return NextResponse.json({ok:false,error:"LiveKit is not configured on the server."},{status:503});
    const r=await fetch(host(u)+"/twirp/livekit.Egress/StopEgress",{
      method:"POST",headers:{"Authorization":"Bearer "+token(k,s),"Content-Type":"application/json"},
      body:JSON.stringify({egress_id:egressId}),cache:"no-store"
    });
    const t=await r.text();let d:any;try{d=JSON.parse(t)}catch{d={raw:t}};
    if(!r.ok)return NextResponse.json({ok:false,error:d?.message||d?.error||"LiveKit could not stop the stream.",details:d},{status:502});
    return NextResponse.json({ok:true,status:d.status,message:"Facebook stream stopped."});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Unable to stop Facebook stream."},{status:500});}
}
