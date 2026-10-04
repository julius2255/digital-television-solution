import {NextResponse} from "next/server";

const allowedVoices=new Set(["en-GB-RyanNeural","en-GB-SoniaNeural","en-US-GuyNeural","en-US-JennyNeural","en-US-AriaNeural"]);

export async function POST(req:Request){
  try{
    const {text,voice}=await req.json();
    const key=process.env.AZURE_SPEECH_KEY;
    const region=process.env.AZURE_SPEECH_REGION;
    if(!key||!region)return NextResponse.json({error:"Azure Speech is not configured"},{status:503});
    if(typeof text!=="string"||!text.trim())return NextResponse.json({error:"Text is required"},{status:400});
    const selectedVoice=typeof voice==="string"&&allowedVoices.has(voice)?voice:"en-GB-RyanNeural";
    const safeText=text.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]||c));
    const ssml=`<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xml:lang="en-GB" xmlns="http://www.w3.org/2001/10/synthesis">
  <voice name="${selectedVoice}">
    <prosody rate="-8%" pitch="0%">${safeText}</prosody>
  </voice>
</speak>`;
    const response=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{
      method:"POST",
      headers:{"Ocp-Apim-Subscription-Key":key,"Content-Type":"application/ssml+xml","X-Microsoft-OutputFormat":"audio-24khz-48kbitrate-mono-mp3","User-Agent":"Digital-Television-Solution"},
      body:ssml,cache:"no-store"
    });
    if(!response.ok)return NextResponse.json({error:"Azure Speech request failed"},{status:502});
    return new NextResponse(await response.arrayBuffer(),{status:200,headers:{"Content-Type":"audio/mpeg","Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"Unable to generate AI voice"},{status:500});}
}
