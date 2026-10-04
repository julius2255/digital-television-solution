import {NextResponse} from "next/server";
import crypto from "node:crypto";
import {facebookConfig,facebookScopes,FACEBOOK_GRAPH_VERSION} from "../../../../lib/facebook";

export async function GET(request:Request){
  const {appId,redirectUri}=facebookConfig();
  if(!appId||!redirectUri){
    return NextResponse.json({error:"Facebook is not configured. Add META_APP_ID and NEXT_PUBLIC_APP_URL or META_FACEBOOK_REDIRECT_URI."},{status:503});
  }
  const state=crypto.randomBytes(24).toString("base64url");
  const url=new URL("https://www.facebook.com/"+FACEBOOK_GRAPH_VERSION+"/dialog/oauth");
  url.searchParams.set("client_id",appId);
  url.searchParams.set("redirect_uri",redirectUri);
  url.searchParams.set("state",state);
  url.searchParams.set("scope",facebookScopes().join(","));
  const response=NextResponse.redirect(url);
  response.cookies.set("dtv_fb_oauth_state",state,{httpOnly:true,secure:true,sameSite:"lax",maxAge:600,path:"/"});
  return response;
}