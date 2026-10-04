import crypto from "node:crypto";

export const FACEBOOK_GRAPH_VERSION=process.env.META_GRAPH_VERSION||"v26.0";
export const facebookConfig=()=>{
  const appId=process.env.META_APP_ID||"";
  const appSecret=process.env.META_APP_SECRET||"";
  const appUrl=(process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"");
  const redirectUri=process.env.META_FACEBOOK_REDIRECT_URI||appUrl+"/api/facebook/callback";
  return {appId,appSecret,appUrl,redirectUri};
};
export const facebookScopes=()=>{
  return (process.env.META_FACEBOOK_SCOPES||"public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,publish_video").split(",").map(x=>x.trim()).filter(Boolean);
};
export const graphUrl=(path:string)=>"https://graph.facebook.com/"+FACEBOOK_GRAPH_VERSION+"/"+path.replace(/^\//,"");

const secretKey=()=>crypto.createHash("sha256").update(process.env.FB_SESSION_SECRET||"change-this-secret-in-production").digest();
export function encryptSession(value:unknown){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",secretKey(),iv);
  const data=Buffer.from(JSON.stringify(value));
  const encrypted=Buffer.concat([cipher.update(data),cipher.final()]);
  return [iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
}
export function decryptSession(value:string){
  try{
    const [iv,tag,data]=value.split(".");
    if(!iv||!tag||!data)return null;
    const decipher=crypto.createDecipheriv("aes-256-gcm",secretKey(),Buffer.from(iv,"base64url"));
    decipher.setAuthTag(Buffer.from(tag,"base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8"));
  }catch{return null}
}
export function safeError(value:unknown){
  if(value instanceof Error)return value.message;
  return typeof value==="string"?value:"Facebook request failed";
}