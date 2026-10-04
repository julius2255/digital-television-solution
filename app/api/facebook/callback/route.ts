import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {facebookConfig,graphUrl,FACEBOOK_GRAPH_VERSION,encryptSession,safeError} from "../../../../lib/facebook";

export async function GET(request:Request){
  const url=new URL(request.url);
  const code=url.searchParams.get("code");
  const state=url.searchParams.get("state");
  const oauthError=url.searchParams.get("error_description")||url.searchParams.get("error");
  const jar=await cookies();
  const savedState=jar.get("dtv_fb_oauth_state")?.value;
  const {appId,appSecret,redirectUri,appUrl}=facebookConfig();
  if(oauthError)return NextResponse.redirect((appUrl||url.origin)+"/?facebook=error&message="+encodeURIComponent(oauthError));
  if(!code||!state||!savedState||state!==savedState)return NextResponse.redirect((appUrl||url.origin)+"/?facebook=error&message="+encodeURIComponent("Facebook login state expired. Please connect again."));
  if(!appId||!appSecret)return NextResponse.redirect((appUrl||url.origin)+"/?facebook=error&message="+encodeURIComponent("Facebook app credentials are not configured."));
  try{
    const tokenUrl=new URL(graphUrl("oauth/access_token"));
    tokenUrl.searchParams.set("client_id",appId);
    tokenUrl.searchParams.set("client_secret",appSecret);
    tokenUrl.searchParams.set("redirect_uri",redirectUri);
    tokenUrl.searchParams.set("code",code);
    const tokenResponse=await fetch(tokenUrl,{cache:"no-store"});
    const token=await tokenResponse.json();
    if(!tokenResponse.ok||!token.access_token)throw new Error(token.error?.message||"Could not exchange Facebook authorization code.");
    const meResponse=await fetch(graphUrl("me")+"?fields=id,name&access_token="+encodeURIComponent(token.access_token),{cache:"no-store"});
    const me=await meResponse.json();
    if(!meResponse.ok)throw new Error(me.error?.message||"Could not read Facebook account.");
    const accountsResponse=await fetch(graphUrl("me/accounts")+"?fields=id,name,access_token,category,tasks&access_token="+encodeURIComponent(token.access_token),{cache:"no-store"});
    const accounts=await accountsResponse.json();
    if(!accountsResponse.ok)throw new Error(accounts.error?.message||"Could not load Facebook Pages.");
    const session=encryptSession({user:{id:me.id,name:me.name||"Facebook user"},userToken:token.access_token,pages:accounts.data||[],createdAt:Date.now()});
    const response=NextResponse.redirect((appUrl||url.origin)+"/?facebook=connected");
    response.cookies.set("dtv_fb_session",session,{httpOnly:true,secure:true,sameSite:"lax",maxAge:60*60*24*30,path:"/"});
    response.cookies.set("dtv_fb_oauth_state","",{httpOnly:true,secure:true,sameSite:"lax",maxAge:0,path:"/"});
    return response;
  }catch(error){
    return NextResponse.redirect((appUrl||url.origin)+"/?facebook=error&message="+encodeURIComponent(safeError(error)));
  }
}