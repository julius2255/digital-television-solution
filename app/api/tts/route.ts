import {NextResponse} from "next/server";

const allowedVoices=new Set([
  "en-GB-RyanNeural",
  "en-GB-SoniaNeural",
  "en-US-GuyNeural",
  "en-US-JennyNeural",
  "en-US-AriaNeural"
]);

const voiceLocale=(voice:string)=>voice.startsWith("en-US-")?"en-US":"en-GB";

export async function POST(req:Request){
  try{
    const {text,voice}=await req.json();
    const key=process.env.AZURE_SPEECH_KEY?.trim();
    const region=process.env.AZURE_SPEECH_REGION?.trim().toLowerCase();
    if(!key||!region)return NextResponse.json({error:"Azure Speech is not configured. Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in Vercel Environment Variables."},{status:503});
    if(typeof text!=="string"||!text.trim())return NextResponse.json({error:"Text is required"},{status:400});
    const selectedVoice=typeof voice==="string"&&allowedVoices.has(voice)?voice:"en-US-AriaNeural";
    const locale=voiceLocale(selectedVoice);
    const safeText=text.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]||c));
    const ssml=`<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis">
  <voice name="${selectedVoice}">
    <prosody rate="-5%" pitch="0%">
      ${safeText}
    </prosody>
  </voice>
</speak>`;
    const response=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{
      method:"POST",
      headers:{
        "Ocp-Apim-Subscription-Key":key,
        "Content-Type":"application/ssml+xml",
        "X-Microsoft-OutputFormat":"audio-24khz-96kbitrate-mono-mp3",
        "User-Agent":"Digital-Television-Solution"
      },
      body:ssml,
      cache:"no-store"
    });
    if(!response.ok){
      const detail=(await response.text()).replace(/\s+/g," ").slice(0,300);
      if(response.status===401)return NextResponse.json({error:"Azure rejected the Speech key or region. Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION."},{status:502});
      if(response.status===429)return NextResponse.json({error:"Azure Speech quota or rate limit reached."},{status:502});
      return NextResponse.json({error:`Azure Speech returned HTTP ${response.status}.${detail?" "+detail:""}`},{status:502});
    }
    return new NextResponse(await response.arrayBuffer(),{
      status:200,
      headers:{"Content-Type":"audio/mpeg","Cache-Control":"no-store"}
    });
  }catch{
    return NextResponse.json({error:"Unable to reach Azure Speech. Check the Speech region and network settings."},{status:500});
  }
}
