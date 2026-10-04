import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {decryptSession,graphUrl,safeError} from "../../../../lib/facebook";

export async function POST(request:Request){
  const session=decryptSession((await cookies()).get("dtv_fb_session")?.value||"") as {pages?:Array<{id:string;name:string;access_token:string}>}|null;
  if(!session)return NextResponse.json({error:"Connect Facebook first."},{status:401});
  const body=await request.json().catch(()=>({}));
  const pageId=String(body.pageId||"");
  const page=session.pages?.find(p=>p.id===pageId);
  if(!page?.access_token)return NextResponse.json({error:"Choose a Facebook Page you manage."},{status:400});
  const params=new URLSearchParams();
  params.set("status","UNPUBLISHED");
  params.set("title",String(body.title||"CHEMCHEM TV KENYA LIVE").slice(0,254));
  if(body.description)params.set("description",String(body.description).slice(0,5000));
  params.set("access_token",page.access_token);
  const response=await fetch(graphUrl(page.id+"/live_videos"),{method:"POST",body:params,cache:"no-store"});
  const data=await response.json();
  if(!response.ok||!data.id)return NextResponse.json({error:data.error?.message||"Facebook could not create the live broadcast.",details:data.error?.error_subcode||null},{status:400});
  return NextResponse.json({ok:true,page:{id:page.id,name:page.name},liveVideoId:data.id,streamUrl:data.secure_stream_url||data.stream_url||"",previewUrl:data.permalink_url||"",raw:{id:data.id}});
}