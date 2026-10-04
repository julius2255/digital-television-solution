import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {decryptSession,graphUrl} from "../../../../lib/facebook";

export async function GET(request:Request){
  const session=decryptSession((await cookies()).get("dtv_fb_session")?.value||"") as {pages?:Array<{id:string;name:string;access_token:string}>}|null;
  if(!session)return NextResponse.json({connected:false});
  const id=new URL(request.url).searchParams.get("id")||"";
  const page=session.pages?.find(p=>p.id===id);
  if(!page)return NextResponse.json({connected:false,error:"Page not found."},{status:404});
  const response=await fetch(graphUrl("debug_token")+"?input_token="+encodeURIComponent(page.access_token)+"&access_token="+encodeURIComponent(page.access_token),{cache:"no-store"});
  const data=await response.json();
  return NextResponse.json({connected:true,page:{id:page.id,name:page.name},tokenValid:Boolean(response.ok&&data.data?.is_valid)});
}