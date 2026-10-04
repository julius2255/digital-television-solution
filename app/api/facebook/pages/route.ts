import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {decryptSession} from "../../../../lib/facebook";

export async function GET(){
  const session=decryptSession((await cookies()).get("dtv_fb_session")?.value||"") as {user?:{name?:string};pages?:Array<{id:string;name:string;category?:string;tasks?:string[]}>}|null;
  if(!session)return NextResponse.json({connected:false,pages:[]});
  return NextResponse.json({connected:true,user:session.user||null,pages:(session.pages||[]).map(p=>({id:p.id,name:p.name,category:p.category||"",tasks:p.tasks||[]}))});
}