import {NextResponse} from "next/server";
import {cookies} from "next/headers";
export async function POST(){
  const response=NextResponse.json({ok:true});
  response.cookies.set("dtv_fb_session","",{httpOnly:true,secure:true,sameSite:"lax",maxAge:0,path:"/"});
  return response;
}