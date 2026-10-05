"use client";

import {useEffect,useRef,useState} from "react";
import {upload} from "@vercel/blob/client";
type Section="studio"|"playlist"|"schedule"|"news"|"media"|"streaming"|"analytics"|"settings";
type MediaFile={id:string;name:string;type:string;url:string;size:number};
type NewsOnAir={title:string;description:string;image?:string;source?:string;category?:string;published?:string;link?:string};
type Scene={id:string;name:string};
type Source={id:string;name:string;kind:string;mediaId?:string;url?:string;visible:boolean};
type StudioLayer={id:string;name:string;kind:"video"|"image"|"text";mediaId?:string;text?:string;x:number;y:number;width:number;height:number;rotation:number;opacity:number;zoom:number;cropTop:number;cropRight:number;cropBottom:number;cropLeft:number;visible:boolean;locked:boolean;role?:"channel-logo"|"show-logo";};
const youtubeEmbedUrl=(value:string)=>{
  try{
    const u=new URL(value);
    let id="";
    if(u.hostname==="youtu.be") id=u.pathname.replace(/^\//,"").split("/")[0];
    else if(u.hostname.includes("youtube.com")){
      id=u.searchParams.get("v")||u.pathname.split("/").filter(Boolean)[1]||"";
    }
    return id ? `https://www.youtube.com/embed/${id}?enablejsapi=1&playsinline=1&controls=1&rel=0` : "";
  }catch{return ""}
};
const isYoutubeEmbed=(value:string)=>value.includes("youtube.com/embed/");


const tabs:[Section,string,string][]=[
  ["studio","▣","Studio"],["playlist","☷","Playlist"],["schedule","▣","Schedule"],
  ["news","▤","Auto News"],["media","▧","Media"],["streaming","◉","Streaming"],
  ["analytics","▥","Analytics"],["settings","⚙","Settings"]
];

const initialScenes:Scene[]=[
  {id:"main",name:"Main"},{id:"live-show",name:"Live Show"},{id:"sports",name:"Sports"},
  {id:"news",name:"News"},{id:"entertainment",name:"Entertainment"}
];

const initialSources:Source[]=[
  {id:"camera",name:"Camera",kind:"Camera",visible:true},
  {id:"screen",name:"Screen Capture",kind:"Screen",visible:true},
  {id:"video",name:"Video",kind:"Video",visible:true},
  {id:"image",name:"Image",kind:"Image",visible:true},
  {id:"audio",name:"Audio",kind:"Audio",visible:true},
  {id:"web",name:"Web Browser",kind:"Web",visible:true},
  {id:"text",name:"Text",kind:"Text",visible:true},
  {id:"media",name:"Media File",kind:"Media",visible:true}
];

const seedSchedule=[
  ["07:00","Morning Live","Camera"],["10:00","Morning News","Auto News"],
  ["11:15","Talk Show","Video"],["13:00","Midday News","Auto News"],
  ["15:50","Movie","Video"],["18:00","Evening News","Auto News"],
  ["20:00","Entertainment Live","Video"],["22:00","Movie Night","Video"]
];

export default function Home(){
  const [section,setSection]=useState<Section>("studio");
  const [live,setLive]=useState(false);
  const [scenes,setScenes]=useState<Scene[]>(initialScenes);
  const [activeScene,setActiveScene]=useState("main");
  const [sources,setSources]=useState<Source[]>(initialSources);
  const [activeSource,setActiveSource]=useState("video");
  const [mediaFiles,setMediaFiles]=useState<MediaFile[]>([]);
  const [playlistIds,setPlaylistIds]=useState<string[]>([]);
  const [previewMediaId,setPreviewMediaId]=useState("");
  const [programMediaId,setProgramMediaId]=useState("");
  const [previewWebUrl,setPreviewWebUrl]=useState("");
  const [programWebUrl,setProgramWebUrl]=useState("");
  const [previewPlaying,setPreviewPlaying]=useState(false);
  const [programPlaying,setProgramPlaying]=useState(false);
  const [previewLayers,setPreviewLayers]=useState<StudioLayer[]>([]);
  const [programLayers,setProgramLayers]=useState<StudioLayer[]>([]);
  const [previewTime,setPreviewTime]=useState(0);
  const [programTime,setProgramTime]=useState(0);
  const [volume,setVolume]=useState(1);
  const [muted,setMuted]=useState(false);
  const [transition,setTransition]=useState<"cut"|"fade">("cut");
  const [fadeSpeed,setFadeSpeed]=useState(800);
  const [channelLogoId,setChannelLogoId]=useState("");
  const [showLogoMap,setShowLogoMap]=useState<Record<string,string>>({});
  const [toast,setToast]=useState("");
  const [connected,setConnected]=useState<Record<string,boolean>>({YouTube:false,Facebook:false,TikTok:false,"Custom RTMP":false});
  const [streamStartedAt,setStreamStartedAt]=useState<number|null>(null);
  const [totalViews,setTotalViews]=useState(0);
  const [peakViewers,setPeakViewers]=useState(0);
  const cameraStreamRef=useRef<MediaStream|null>(null);
  const screenStreamRef=useRef<MediaStream|null>(null);
  const [cameraReady,setCameraReady]=useState(false);
  const [screenReady,setScreenReady]=useState(false);
  const [cameraFacing,setCameraFacing]=useState<"user"|"environment">("user");
  const [schedule,setSchedule]=useState<string[][]>(seedSchedule);
  const [autoSchedule,setAutoSchedule]=useState(true);
  const [scheduleClock,setScheduleClock]=useState("");
  const lastAutoSlotRef=useRef("");
  const fileInputRef=useRef<HTMLInputElement>(null);
  const [newsOnAir,setNewsOnAir]=useState<NewsOnAir|null>(null);
  const [broadcastDockOpen,setBroadcastDockOpen]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    const loadNews=async()=>{try{const r=await fetch("/api/news?category=Kenya&source=STANDARD%20KENYA",{cache:"no-store"});const j=await r.json();const item=j.items?.[0];if(!cancelled&&item)setNewsOnAir(item)}catch{}};
    loadNews();const id=window.setInterval(loadNews,120000);return()=>{cancelled=true;window.clearInterval(id)};
  },[]);

  useEffect(()=>{try{const s=localStorage.getItem("dtv-schedule");if(s)setSchedule(JSON.parse(s));const a=localStorage.getItem("dtv-auto-schedule");if(a!==null)setAutoSchedule(a==="true");const pl=localStorage.getItem("dtv-playlist");if(pl)setPlaylistIds(JSON.parse(pl));const fs=localStorage.getItem("dtv-fade-speed");if(fs)setFadeSpeed(Number(fs));const cl=localStorage.getItem("dtv-channel-logo");if(cl)setChannelLogoId(cl);const sl=localStorage.getItem("dtv-show-logos");if(sl)setShowLogoMap(JSON.parse(sl))}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem("dtv-schedule",JSON.stringify(schedule));localStorage.setItem("dtv-auto-schedule",String(autoSchedule));localStorage.setItem("dtv-playlist",JSON.stringify(playlistIds));localStorage.setItem("dtv-fade-speed",String(fadeSpeed));localStorage.setItem("dtv-channel-logo",channelLogoId);localStorage.setItem("dtv-show-logos",JSON.stringify(showLogoMap))}catch{}},[schedule,autoSchedule,playlistIds,fadeSpeed,channelLogoId,showLogoMap]);
  useEffect(()=>{const tick=()=>{const d=new Date();const t=String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");setScheduleClock(t)};tick();const id=window.setInterval(tick,15000);return()=>window.clearInterval(id)},[]);

  const buildBroadcastLayers=(media:MediaFile,showName?:string)=>{
    const base:StudioLayer={id:"base",name:media.name,kind:media.type.startsWith("image/")?"image":"video",mediaId:media.id,x:0,y:0,width:100,height:100,rotation:0,opacity:1,zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,visible:true,locked:false};
    const logos:StudioLayer[]=[];
    const channel=channelLogoId?mediaFiles.find(f=>f.id===channelLogoId):null;
    if(channel)logos.push({id:"channel-logo",name:"Channel Logo",kind:"image",mediaId:channel.id,x:3,y:3,width:15,height:15,rotation:0,opacity:1,zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,visible:true,locked:true,role:"channel-logo"});
    const showId=showName?showLogoMap[showName]:"";
    const show=showId?mediaFiles.find(f=>f.id===showId):null;
    if(show)logos.push({id:"show-logo",name:"Show Logo",kind:"image",mediaId:show.id,x:82,y:4,width:15,height:15,rotation:0,opacity:1,zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,visible:true,locked:true,role:"show-logo"});
    return [base,...logos];
  };

  useEffect(()=>{
    if(!autoSchedule||!scheduleClock||!schedule.length)return;
    const ordered=[...schedule].filter(r=>/^\d{2}:\d{2}$/.test(r[0]||"")).sort((a,b)=>a[0].localeCompare(b[0]));
    const row=[...ordered].reverse().find(r=>r[0]<=scheduleClock)||ordered[ordered.length-1];
    if(!row||lastAutoSlotRef.current===row[0])return;
    lastAutoSlotRef.current=row[0];
    if(!row[3]&&row[2]==="Camera"){
      if(cameraStreamRef.current){
        setPreviewMediaId("");
        setPreviewWebUrl("");
        setPreviewLayers([]);
        setPreviewPlaying(true);
        setProgramMediaId("");
        setProgramWebUrl("");
        setProgramLayers([]);
        setProgramPlaying(true);
        setActiveSource("camera");
        setTransition("cut");
        notify("AUTO: "+row[1]+" is now live from Camera");
      }else{
        setProgramPlaying(false);
        notify("AUTO: "+row[1]+" needs the Camera source started — standby fallback");
      }
      return;
    }
    if(!row[3]){
      if(row[2]==="Auto News"){
        setSection("news");
        setActiveSource("news");
        setProgramPlaying(true);
        setTransition("cut");
        notify("AUTO: "+row[1]+" — Auto News is ON AIR");
        return;
      }
      setProgramPlaying(false);
      notify("AUTO: "+row[1]+" has no assigned media — standby fallback");
      return;
    }
    const media=mediaFiles.find(f=>f.id===row[3]);
    if(!media)return;
    setPreviewMediaId(media.id);
    setPreviewWebUrl("");
    setPreviewLayers(buildBroadcastLayers(media,row[1]));
    setPreviewPlaying(false);
    setProgramMediaId(media.id);
    setProgramWebUrl("");
    setProgramLayers(buildBroadcastLayers(media,row[1]));
    setProgramPlaying(true);
    setProgramTime(0);
    setActiveSource("media");
    setTransition("cut");
    notify("AUTO: "+media.name+" is now playing on Program");
  },[autoSchedule,scheduleClock,schedule,mediaFiles]);

  const notify=(message:string)=>{setToast(message);setTimeout(()=>setToast(""),2200)};
  const previewMedia=mediaFiles.find(f=>f.id===previewMediaId)||null;
  const programMedia=mediaFiles.find(f=>f.id===programMediaId)||null;

  const addFiles=async(files:FileList|null)=>{
    if(!files)return;
    const selected=Array.from(files);
    if(!selected.length)return;
    notify("Uploading "+selected.length+" media file"+(selected.length>1?"s":"")+" to CHEMCHEM cloud storage…");
    const incoming:MediaFile[]=[];
    for(let i=0;i<selected.length;i++){
      const file=selected[i];
      try{
        const blob=await upload("chemchem/"+Date.now()+"-"+file.name,file,{
          access:"public",
          handleUploadUrl:"/api/media/upload",
          contentType:file.type||"application/octet-stream",
          multipart:file.size>8*1024*1024,
          onUploadProgress:(event)=>{
            if(event.total){
              notify("Uploading "+file.name+" — "+Math.round(event.percentage)+"%");
            }
          }
        });
        incoming.push({
          id:blob.url,
          name:file.name,
          type:file.type||"application/octet-stream",
          url:blob.url,
          size:file.size
        });
      }catch(error){
        notify("Upload failed for "+file.name);
      }
    }
    if(!incoming.length)return;
    setMediaFiles(v=>[...v,...incoming]);
    setPlaylistIds(v=>[...v,...incoming.map(x=>x.id)]);
    const first=incoming[0];
    setPreviewMediaId(first.id);
    setPreviewPlaying(false);
    setActiveSource(first.type.startsWith("audio/")?"audio":first.type.startsWith("image/")?"image":"video");
    notify(incoming.length+" media file"+(incoming.length>1?"s":"")+" uploaded. "+first.name+" is ready in Preview.");
  };

  const selectMedia=(id:string)=>{
    setPreviewMediaId(id);
    setPreviewPlaying(false);
    setPreviewTime(0);
    setActiveSource("media");
    const file=mediaFiles.find(x=>x.id===id);
    if(file)notify(file.name+" is ready in Preview — Program is unchanged");
  };

  const removeMedia=(id:string)=>{
    const f=mediaFiles.find(x=>x.id===id);
    if(f)URL.revokeObjectURL(f.url);
    setMediaFiles(v=>v.filter(x=>x.id!==id));
    setPlaylistIds(v=>v.filter(x=>x!==id));
    if(previewMediaId===id){setPreviewMediaId("");setPreviewPlaying(false)}
    notify("Media removed");
  };

  const addScene=()=>{
    const name=prompt("Scene name","New Scene");
    if(!name?.trim())return;
    const scene={id:String(Date.now()),name:name.trim()};
    setScenes(v=>[...v,scene]);setActiveScene(scene.id);notify("Scene added");
  };

  const startCamera=async()=>{try{if(cameraStreamRef.current){setCameraReady(true);setActiveSource("camera");return;}const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:cameraFacing}},audio:true});cameraStreamRef.current=stream;setCameraReady(true);setActiveSource("camera");setPreviewMediaId("");setPreviewWebUrl("");setPreviewPlaying(true);setPreviewLayers([]);notify(cameraFacing==="user"?"Front camera is ready in Preview":"Back camera is ready in Preview")}catch{notify("Camera access was denied or is unavailable")}};
  const flipCamera=async()=>{const next=cameraFacing==="user"?"environment":"user" as "user"|"environment";try{if(cameraStreamRef.current)cameraStreamRef.current.getTracks().forEach(t=>t.stop());const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{exact:next}},audio:true});cameraStreamRef.current=stream;setCameraFacing(next);setCameraReady(true);setActiveSource("camera");notify(next==="user"?"Switched to front camera":"Switched to back camera")}catch{try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:next}},audio:true});cameraStreamRef.current=stream;setCameraFacing(next);setCameraReady(true);setActiveSource("camera");notify(next==="user"?"Switched to front camera":"Switched to back camera")}catch{notify("Could not switch camera on this device")}}};
  const stopCamera=()=>{cameraStreamRef.current?.getTracks().forEach(t=>t.stop());cameraStreamRef.current=null;setCameraReady(false);if(activeSource==="camera")setActiveSource("video");notify("Camera source stopped")};
  const startScreenShare=async()=>{try{if(!navigator.mediaDevices?.getDisplayMedia){notify("Screen capture is not supported by this browser");return;}if(screenStreamRef.current){setScreenReady(true);setActiveSource("screen");return;}const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});screenStreamRef.current=stream;setScreenReady(true);setActiveSource("screen");setPreviewMediaId("");setPreviewWebUrl("");setPreviewPlaying(true);setPreviewLayers([]);stream.getVideoTracks()[0]?.addEventListener("ended",()=>{screenStreamRef.current=null;setScreenReady(false);if(activeSource==="screen")setActiveSource("video");notify("Screen sharing stopped")});notify("Screen capture is ready in Preview")}catch{notify("Screen sharing was cancelled or unavailable")}};
  const stopScreenShare=()=>{screenStreamRef.current?.getTracks().forEach(t=>t.stop());screenStreamRef.current=null;setScreenReady(false);if(activeSource==="screen")setActiveSource("video");notify("Screen capture stopped")};
  const addSource=()=>{
    const name=prompt("Source name","New Source");
    if(!name?.trim())return;
    const source={id:String(Date.now()),name:name.trim(),kind:"Custom",visible:true};
    setSources(v=>[...v,source]);setActiveSource(source.id);notify("Source added");
  };

  const addWebSource=()=>{
    const url=prompt("Web page or YouTube URL","https://");
    if(!url?.trim())return;
    const raw=url.trim();
    const embed=youtubeEmbedUrl(raw);
    const source={id:String(Date.now()),name:embed?"YouTube":"Web Browser",kind:"Web",url:embed||raw,visible:true};
    setSources(v=>[...v,source]);setActiveSource(source.id);setPreviewMediaId("");setPreviewWebUrl(embed||raw);setPreviewPlaying(false);notify(embed?"YouTube video loaded into Preview":"Web page loaded into Preview");
  };

  const take=(mode:"cut"|"fade"=transition,time=previewTime)=>{
    if(!previewMedia&&!previewWebUrl&&previewLayers.length===0){
      notify("Build a Preview composition first");
      return;
    }
    setProgramMediaId(previewMedia?.id||"");
    setProgramWebUrl(youtubeEmbedUrl(previewWebUrl)||previewWebUrl);
    setProgramPlaying(previewWebUrl?true:previewPlaying);
    setProgramTime(time);
    setProgramLayers(previewLayers.map(x=>({...x})));
    setTransition(mode);
    notify(mode==="fade"?"FADE full Preview composition to Program":"CUT full Preview composition to Program");
  };

  const togglePreview=()=>{
    if(previewWebUrl){
      if(isYoutubeEmbed(previewWebUrl)){setPreviewPlaying(v=>!v);return}
      notify("This web page is loaded in Preview. Use CUT or FADE to send it to Program.");return
    }
    if(!previewMedia){notify("Select a video, image or audio item first");return}
    if(previewMedia.type.startsWith("image/")){notify("Image is already visible in Preview");return}
    setPreviewPlaying(v=>!v);
  };

  const stopPreview=()=>{setPreviewPlaying(false);setPreviewTime(0);setPreviewWebUrl("")};
  const toggleProgram=()=>{
    if(programWebUrl){
      if(isYoutubeEmbed(programWebUrl)){setProgramPlaying(v=>!v);return}
      notify("Generic web pages cannot be paused from the control room; YouTube sources can.");return
    }
    if(!programMedia){notify("No video is currently on Program");return}
    setProgramPlaying(v=>!v)
  };
  const switchProgramSource=(source:"camera"|"screen"|"news")=>{if(source==="camera"&&!cameraStreamRef.current){startCamera();notify("Starting Camera for Program");return;}if(source==="screen"&&!screenStreamRef.current){startScreenShare();notify("Starting Screen Capture for Program");return;}if(source==="news"&&!newsOnAir){notify("News is still loading");return;}setActiveSource(source);setProgramMediaId("");setProgramWebUrl("");setProgramLayers([]);setProgramTime(0);setProgramPlaying(true);setTransition("cut");notify("PROGRAM SOURCE: "+(source==="camera"?"Camera":source==="screen"?"Screen Capture":"Auto News"));};
  const toggleLive=()=>{if(live){setLive(false);setStreamStartedAt(null);notify("Broadcast stopped");return;}setLive(true);setStreamStartedAt(Date.now());notify("CHEMCHEM TV KENYA is ON AIR")};

  const playMedia=(id:string)=>{setPreviewMediaId(id);setPreviewWebUrl("");setPreviewTime(0);setPreviewPlaying(true);setActiveSource("media");const file=mediaFiles.find(x=>x.id===id);if(file)notify(file.name+" started in Preview")};
  const movePlaylist=(id:string,dir:number)=>setPlaylistIds(v=>{const i=v.indexOf(id),j=i+dir;if(i<0||j<0||j>=v.length)return v;const a=[...v];[a[i],a[j]]=[a[j],a[i]];return a});
  const removeFromPlaylist=(id:string)=>setPlaylistIds(v=>v.filter(x=>x!==id));
  const addToPlaylist=(id:string)=>setPlaylistIds(v=>v.includes(id)?v:[...v,id]);
  const playPlaylistItem=(id:string)=>{const file=mediaFiles.find(x=>x.id===id);if(!file)return;setPreviewMediaId(id);setPreviewWebUrl("");setPreviewTime(0);setPreviewPlaying(false);setProgramMediaId(id);setProgramWebUrl("");setProgramTime(0);setProgramPlaying(true);const layers=buildBroadcastLayers(file);setProgramLayers(layers);setPreviewLayers(layers.map(x=>({...x})));notify("RUN ORDER: "+file.name)};
  const playNextPlaylistItem=(currentId:string)=>{const i=playlistIds.indexOf(currentId);const nextId=playlistIds[i+1];if(nextId){playPlaylistItem(nextId);return true}return false};

  const playScheduled=(row:string[])=>{
    if(row[2]==="Auto News"){
      setSection("news");
      setActiveSource("news");
      setPreviewMediaId("");
      setPreviewWebUrl("");
      setPreviewLayers([]);
      setPreviewPlaying(true);
      setProgramMediaId("");
      setProgramWebUrl("");
      setProgramLayers([]);
      setProgramPlaying(true);
      setTransition("cut");
      notify("PROGRAM NOW: "+row[1]+" — Auto News is ON AIR");
      return;
    }
    const id=row[3];
    if(!id){notify("No video is assigned to this programme");return;}
    const media=mediaFiles.find(x=>x.id===id);
    if(!media){notify("Scheduled media is not available");return;}
    setPreviewMediaId(media.id);
    setPreviewWebUrl("");
    setPreviewLayers(buildBroadcastLayers(media,row[1]));
    setPreviewPlaying(false);
    setPreviewTime(0);
    setProgramMediaId(media.id);
    setProgramWebUrl("");
    setProgramLayers(buildBroadcastLayers(media,row[1]));
    setProgramPlaying(true);
    setProgramTime(0);
    setActiveSource("media");
    setTransition("cut");
    notify("PROGRAM NOW: "+media.name);
  };

  const addProgramme=()=>{
    const name=prompt("Programme name","New Programme");
    if(!name?.trim())return;
    const time=prompt("Start time (HH:MM)","12:00")||"12:00";
    setSchedule(v=>[...v,[time,name.trim(),"Video",""]].sort((a,b)=>a[0].localeCompare(b[0])));
    notify("Programme added");
  };

  return <main className="appOne">
    <header className="topbar">
      <div className="brand"><div className="logo">CTV</div><div><b>CHEMCHEM TV KENYA</b><small>Professional Broadcast Control Room</small></div></div>
      <div className={"air "+(live?"on":"")}><i/> {live?"ON AIR":"STANDBY"}</div>
      <div className="actions"><span>● System Ready</span><button className="go" onClick={toggleLive}>{live?"STOP LIVE":"GO LIVE"}</button></div>
    </header>

    <nav className="workTabs">{tabs.map(([id,icon,label])=><button key={id} className={"workTab "+(section===id?"active":"")} onClick={()=>setSection(id)}><span>{icon}</span>{label}</button>)}</nav>

    <section className="workspace">
      <div style={{display:section==="studio"?"block":"none"}}>
        <Studio
          preview={previewMedia} program={programMedia} previewWebUrl={previewWebUrl} programWebUrl={programWebUrl} previewPlaying={previewPlaying} programPlaying={programPlaying}
          previewTime={previewTime} programTime={programTime} volume={volume} muted={muted} fadeSpeed={fadeSpeed} setFadeSpeed={setFadeSpeed} channelLogoId={channelLogoId} setChannelLogoId={setChannelLogoId} showLogoMap={showLogoMap} setShowLogoMap={setShowLogoMap}
          previewLayers={previewLayers} setPreviewLayers={setPreviewLayers} programLayers={programLayers}
          setVolume={setVolume} setMuted={setMuted} togglePreview={togglePreview} stopPreview={stopPreview}
          toggleProgram={toggleProgram} take={take} transition={transition} setTransition={setTransition} live={live} toggleLive={toggleLive}
          onProgramEnded={()=>{const current=programMediaId;if(current&&playNextPlaylistItem(current))return;setProgramPlaying(false);setProgramTime(0);notify("Program item finished — waiting for the next scheduled item")}}
          scenes={scenes} activeScene={activeScene} setActiveScene={setActiveScene} addScene={addScene}
          sources={sources} activeSource={activeSource} setActiveSource={setActiveSource} addSource={addSource} addWebSource={addWebSource} switchProgramSource={switchProgramSource}
          newsOnAir={newsOnAir} mediaFiles={mediaFiles} selectMedia={selectMedia} playMedia={playMedia} selectWeb={(url)=>{setPreviewMediaId("");setPreviewWebUrl(url);setPreviewPlaying(false);notify("Web page loaded into Preview")}} upload={()=>fileInputRef.current?.click()} cameraStream={cameraStreamRef.current} cameraReady={cameraReady} cameraFacing={cameraFacing} startCamera={startCamera} flipCamera={flipCamera} stopCamera={stopCamera} screenStream={screenStreamRef.current} screenReady={screenReady} startScreenShare={startScreenShare} stopScreenShare={stopScreenShare}
        />
      </div>
      {section==="playlist"&&<Playlist mediaFiles={mediaFiles} playlistIds={playlistIds} previewMediaId={previewMediaId} selectMedia={selectMedia} playMedia={playMedia} remove={removeMedia} move={movePlaylist} removeFromPlaylist={removeFromPlaylist} addToPlaylist={addToPlaylist} playNow={playPlaylistItem} upload={()=>fileInputRef.current?.click()}/>}
      {section==="schedule"&&<Schedule rows={schedule} now={scheduleClock} auto={autoSchedule} setAuto={setAutoSchedule} setRows={setSchedule} add={addProgramme} mediaFiles={mediaFiles} playNow={playScheduled} showLogoMap={showLogoMap} setShowLogoMap={setShowLogoMap} imageFiles={mediaFiles.filter(f=>f.type.startsWith("image/"))}/>} 
      {section==="news"&&<News notify={notify}/>}
      {section==="media"&&<Media files={mediaFiles} selected={previewMediaId} select={selectMedia} remove={removeMedia} upload={()=>fileInputRef.current?.click()}/>}
      {section==="streaming"&&<Streaming connected={connected} setConnected={setConnected} live={live} program={programMedia} preview={previewMedia} programWebUrl={programWebUrl}/>}
      {section==="analytics"&&<Analytics live={live} program={programMedia} streamStartedAt={streamStartedAt} totalViews={totalViews} peakViewers={peakViewers} connected={connected}/>}
      {section==="settings"&&<Settings notify={notify}/>}
    </section>

    <div style={{marginTop:14,border:"1px solid rgba(255,255,255,.12)",borderRadius:14,background:"#0b1524",overflow:"hidden"}}>
      <button
        onClick={()=>setBroadcastDockOpen(v=>!v)}
        style={{width:"100%",padding:"14px 16px",background:"transparent",border:0,color:"white",display:"flex",justifyContent:"space-between",alignItems:"center",fontWeight:800,cursor:"pointer"}}
      >
        <span>◉ BROADCAST / STREAMING SUB-PAGE</span>
        <span>{live?"● ON AIR":"○ STANDBY"} · {broadcastDockOpen?"CLOSE":"OPEN"}</span>
      </button>
      <div style={{display:broadcastDockOpen?"block":"none",padding:12}}>
        <Streaming connected={connected} setConnected={setConnected} live={live} program={programMedia} preview={previewMedia} programWebUrl={programWebUrl}/>
      </div>
    </div>

    <input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={e=>{addFiles(e.target.files);e.currentTarget.value=""}}/>
    {toast&&<div className="toast">{toast}</div>}
  </main>
}

function Studio(p:{
  preview:MediaFile|null;program:MediaFile|null;previewWebUrl:string;programWebUrl:string;previewPlaying:boolean;programPlaying:boolean;
  previewTime:number;programTime:number;volume:number;muted:boolean;fadeSpeed:number;setFadeSpeed:(v:number)=>void;channelLogoId:string;setChannelLogoId:(v:string)=>void;showLogoMap:Record<string,string>;setShowLogoMap:(v:Record<string,string>)=>void;
  previewLayers:StudioLayer[];setPreviewLayers:(v:StudioLayer[]|((v:StudioLayer[])=>StudioLayer[]))=>void;programLayers:StudioLayer[];
  setVolume:(v:number)=>void;setMuted:(v:boolean)=>void;togglePreview:()=>void;stopPreview:()=>void;toggleProgram:()=>void;
  take:(mode?:"cut"|"fade",time?:number)=>void;transition:"cut"|"fade";setTransition:(v:"cut"|"fade")=>void;
  live:boolean;toggleLive:()=>void;onProgramEnded?:()=>void;scenes:Scene[];activeScene:string;setActiveScene:(v:string)=>void;addScene:()=>void;
  sources:Source[];activeSource:string;newsOnAir:NewsOnAir|null;setActiveSource:(v:string)=>void;addSource:()=>void;addWebSource:()=>void;switchProgramSource:(source:"camera"|"screen"|"news")=>void;
  mediaFiles:MediaFile[];selectMedia:(id:string)=>void;playMedia:(id:string)=>void;selectWeb:(url:string)=>void;upload:()=>void;cameraStream:MediaStream|null;cameraReady:boolean;cameraFacing:"user"|"environment";startCamera:()=>void;flipCamera:()=>void;stopCamera:()=>void;screenStream:MediaStream|null;screenReady:boolean;startScreenShare:()=>void;stopScreenShare:()=>void;
}){
  const previewRef=useRef<HTMLVideoElement>(null);
  const programRef=useRef<HTMLVideoElement>(null);
  const previewWebRef=useRef<HTMLIFrameElement>(null);
  const previewCameraRef=useRef<HTMLVideoElement>(null);const programCameraRef=useRef<HTMLVideoElement>(null);const previewScreenRef=useRef<HTMLVideoElement>(null);const programScreenRef=useRef<HTMLVideoElement>(null);
  useEffect(()=>{if(previewCameraRef.current)previewCameraRef.current.srcObject=p.cameraStream},[p.cameraStream]);useEffect(()=>{if(programCameraRef.current)programCameraRef.current.srcObject=p.cameraStream},[p.cameraStream]);useEffect(()=>{if(previewScreenRef.current)previewScreenRef.current.srcObject=p.screenStream},[p.screenStream]);useEffect(()=>{if(programScreenRef.current)programScreenRef.current.srcObject=p.screenStream},[p.screenStream]);
  const programWebRef=useRef<HTMLIFrameElement>(null);
  const editorRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<{id:string;mode:"move"|"resize"|"crop";startX:number;startY:number;x:number;y:number;width:number;height:number;cropTop:number;cropRight:number;cropBottom:number;cropLeft:number}|null>(null);
  const [previewClock,setPreviewClock]=useState(0);
  const [programClock,setProgramClock]=useState(0);
  const [selectedLayerId,setSelectedLayerId]=useState("");
  const [fadePulse,setFadePulse]=useState(false);
  const [cropMode,setCropMode]=useState(false);
  const [canvasZoom,setCanvasZoom]=useState(100);
  const [snapToGrid,setSnapToGrid]=useState(true);
  const [gridSize,setGridSize]=useState(5);
  const [showGrid,setShowGrid]=useState(true);
  const [canvasPan,setCanvasPan]=useState({x:0,y:0});
  const [handMode,setHandMode]=useState(false);
  const panRef=useRef<{x:number;y:number;startX:number;startY:number}|null>(null);

  useEffect(()=>{if(p.preview&&(!p.previewLayers.some(x=>x.id==="base")||p.previewLayers.find(x=>x.id==="base")?.mediaId!==p.preview.id)){
    const kind=p.preview.type.startsWith("image/")?"image":"video";
    p.setPreviewLayers(prev=>[{id:"base",name:p.preview!.name,kind,mediaId:p.preview!.id,x:0,y:0,width:100,height:100,rotation:0,opacity:1,zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,visible:true,locked:false},...prev.filter(x=>x.id!=="base")]);
  }},[p.preview?.id,p.preview?.type]);

  useEffect(()=>{if(!selectedLayerId&&p.previewLayers.length)setSelectedLayerId(p.previewLayers[0].id);if(selectedLayerId&&!p.previewLayers.some(x=>x.id===selectedLayerId))setSelectedLayerId(p.previewLayers[0]?.id||"")},[p.previewLayers,selectedLayerId]);
  useEffect(()=>{if(previewRef.current)previewRef.current.volume=p.volume},[p.volume,p.preview?.id]);
  useEffect(()=>{if(programRef.current)programRef.current.volume=p.volume},[p.volume,p.program?.id]);
  useEffect(()=>{const v=previewRef.current;if(!v)return;if(p.previewPlaying)v.play().catch(()=>{});else v.pause()},[p.previewPlaying,p.preview?.id]);
  useEffect(()=>{const v=programRef.current;if(!v)return;if(p.programPlaying)v.play().catch(()=>{});else v.pause()},[p.programPlaying,p.program?.id]);

  useEffect(()=>{
    const move=(e:PointerEvent)=>{const d=dragRef.current,el=editorRef.current;if(!d||!el)return;const r=el.getBoundingClientRect();let dx=(e.clientX-d.startX)/r.width*100,dy=(e.clientY-d.startY)/r.height*100;
      if(snapToGrid&&d.mode==="move"){dx=Math.round((d.x+dx)/gridSize)*gridSize-d.x;dy=Math.round((d.y+dy)/gridSize)*gridSize-d.y;}
      p.setPreviewLayers(prev=>prev.map(l=>{
        if(l.id!==d.id)return l;
        if(d.mode==="move")return {...l,x:Math.max(0,Math.min(100-l.width,d.x+dx)),y:Math.max(0,Math.min(100-l.height,d.y+dy))};
        if(d.mode==="crop")return {...l,cropLeft:Math.max(0,Math.min(80,d.cropLeft-dx)),cropRight:Math.max(0,Math.min(80,d.cropRight+dx)),cropTop:Math.max(0,Math.min(80,d.cropTop-dy)),cropBottom:Math.max(0,Math.min(80,d.cropBottom+dy))};
        return {...l,width:Math.max(5,Math.min(100-d.x,d.width+dx)),height:Math.max(5,Math.min(100-d.y,d.height+dy))};
      }));
    };
    const up=()=>{dragRef.current=null};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)}
  },[p.setPreviewLayers]);

  const fmt=(s:number)=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(Math.floor(s%60)).padStart(2,"0");
  const controlYouTube=(ref:{current:HTMLIFrameElement|null},action:"playVideo"|"pauseVideo")=>{ref.current?.contentWindow?.postMessage(JSON.stringify({event:"command",func:action,args:[]}),"*")};
  useEffect(()=>{if(p.previewWebUrl&&isYoutubeEmbed(p.previewWebUrl))controlYouTube(previewWebRef,p.previewPlaying?"playVideo":"pauseVideo")},[p.previewPlaying,p.previewWebUrl]);
  useEffect(()=>{if(p.programWebUrl&&isYoutubeEmbed(p.programWebUrl))controlYouTube(programWebRef,p.programPlaying?"playVideo":"pauseVideo")},[p.programPlaying,p.programWebUrl]);

  const addLayer=(kind:"image"|"video"|"text",file?:MediaFile)=>{
    if(kind==="text"){const text=prompt("Text / lower third","LIVE • BREAKING NEWS");if(!text?.trim())return;const layer:StudioLayer={id:String(Date.now()),name:"Text / Lower Third",kind:"text",text:text.trim(),x:10,y:72,width:80,height:16,rotation:0,opacity:1,zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,visible:true,locked:false};p.setPreviewLayers(v=>[...v,layer]);setSelectedLayerId(layer.id);return}
    if(!file){p.upload();return}
    const layer:StudioLayer={id:String(Date.now())+"-"+Math.random().toString(36).slice(2,6),name:kind==="image"?"Logo / Image":file.name,kind,mediaId:file.id,x:kind==="image"?72:15,y:kind==="image"?6:15,width:kind==="image"?22:55,height:kind==="image"?18:40,rotation:0,opacity:1,zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,visible:true,locked:false};
    p.setPreviewLayers(v=>[...v,layer]);setSelectedLayerId(layer.id)
  };
  const updateLayer=(id:string,patch:Partial<StudioLayer>)=>p.setPreviewLayers(v=>v.map(l=>l.id===id?{...l,...patch}:l));
  const selected=p.previewLayers.find(x=>x.id===selectedLayerId)||null;
  const reorder=(id:string,dir:number)=>p.setPreviewLayers(v=>{const i=v.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=v.length)return v;const a=[...v];[a[i],a[j]]=[a[j],a[i]];return a});
  const removeLayer=(id:string)=>{const layer=p.previewLayers.find(x=>x.id===id);if(id==="base"||layer?.role==="channel-logo"||layer?.role==="show-logo")return;p.setPreviewLayers(v=>v.filter(x=>x.id!==id));setSelectedLayerId("")};
  const duplicateLayer=(id:string)=>{const l=p.previewLayers.find(x=>x.id===id);if(!l)return;const copy={...l,id:String(Date.now())+"-copy",name:l.name+" Copy",x:Math.min(100-l.width,l.x+3),y:Math.min(100-l.height,l.y+3)};p.setPreviewLayers(v=>[...v,copy]);setSelectedLayerId(copy.id)};
  const addGraphicPreset=(type:"lower-third"|"breaking"|"live"|"ticker")=>{
    const presets={
      "lower-third":{name:"DTS Lower Third",text:"DTS NEWS  •  LIVE HEADLINE",x:5,y:76,width:90,height:14},
      breaking:{name:"Breaking News Graphic",text:"● BREAKING NEWS  •  DEVELOPING STORY",x:4,y:78,width:92,height:12},
      live:{name:"LIVE Bug",text:"● LIVE  •  DIGITAL TELEVISION SOLUTION",x:4,y:4,width:38,height:9},
      ticker:{name:"News Ticker",text:"KENYA  •  AFRICA  •  WORLD  •  SPORTS  •  BUSINESS",x:3,y:89,width:94,height:8}
    }[type];
    const layer:StudioLayer={id:String(Date.now())+"-"+type,name:presets.name,kind:"text",text:presets.text,x:presets.x,y:presets.y,width:presets.width,height:presets.height,rotation:0,opacity:1,zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,visible:true,locked:false};
    p.setPreviewLayers(v=>[...v,layer]);setSelectedLayerId(layer.id);notifyGraphic(type);
  };
  const notifyGraphic=(type:string)=>{if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("dtv-graphic",{detail:type}))};
  const beginDrag=(e:React.PointerEvent,id:string,mode:"move"|"resize")=>{if(handMode)return;e.stopPropagation();const l=p.previewLayers.find(x=>x.id===id);if(!l||l.locked)return;const actualMode=(cropMode||e.altKey||e.metaKey)&&l.id!=="base"?"crop":mode;dragRef.current={id,mode:actualMode,startX:e.clientX,startY:e.clientY,x:l.x,y:l.y,width:l.width,height:l.height,cropTop:l.cropTop,cropRight:l.cropRight,cropBottom:l.cropBottom,cropLeft:l.cropLeft};setSelectedLayerId(id)};
  const beginHandle=(e:React.PointerEvent,id:string,handle:string)=>{
    e.stopPropagation();const l=p.previewLayers.find(x=>x.id===id);const el=editorRef.current;if(!l||l.locked||!el)return;
    const r=el.getBoundingClientRect();
    const startX=e.clientX,startY=e.clientY;const sx=(e.clientX-r.left)/r.width*100,sy=(e.clientY-r.top)/r.height*100;
    const onMove=(ev:PointerEvent)=>{
      const dx=(ev.clientX-startX)/r.width*100,dy=(ev.clientY-startY)/r.height*100;
      p.setPreviewLayers(v=>v.map(a=>{
        if(a.id!==id)return a;let {x,y,width,height}=a;
        if(handle.includes("e"))width=Math.max(5,Math.min(100-x,width+dx));
        if(handle.includes("s"))height=Math.max(5,Math.min(100-y,height+dy));
        if(handle.includes("w")){const nx=Math.max(0,Math.min(x+width-5,x+dx));width=x+width-nx;x=nx}
        if(handle.includes("n")){const ny=Math.max(0,Math.min(y+height-5,y+dy));height=y+height-ny;y=ny}
        return {...a,x,y,width,height};
      }));
    };
    const onUp=()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp)};
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);
  };

  const fitCanvas=()=>{setCanvasZoom(100);setCanvasPan({x:0,y:0});panRef.current=null};
  const beginCanvasPan=(e:React.PointerEvent)=>{
    const shouldPan=handMode||e.button===1||e.shiftKey;
    if(!shouldPan)return;
    e.preventDefault();
    panRef.current={x:canvasPan.x,y:canvasPan.y,startX:e.clientX,startY:e.clientY};
  };
  const moveCanvasPan=(e:React.PointerEvent)=>{
    const pan=panRef.current;
    if(!pan)return;
    e.preventDefault();
    setCanvasPan({x:pan.x+(e.clientX-pan.startX),y:pan.y+(e.clientY-pan.startY)});
  };
  const endCanvasPan=()=>{panRef.current=null};

  const handleEditorWheel=(e:React.WheelEvent)=>{
    e.preventDefault();
    if(e.ctrlKey||e.metaKey||e.shiftKey){
      if(!selected||selected.locked)return;
      const next=Math.max(0.25,Math.min(5,selected.zoom+(e.deltaY<0?0.1:-0.1)));
      updateLayer(selected.id,{zoom:Number(next.toFixed(2))});
      return;
    }
    setCanvasZoom(v=>Math.max(60,Math.min(200,v+(e.deltaY<0?10:-10))));
  };
  const renderLayer=(l:StudioLayer,program:boolean)=>{
    if(!l.visible)return null;
    const media=p.mediaFiles.find(x=>x.id===l.mediaId);
    const style:React.CSSProperties={left:l.x+"%",top:l.y+"%",width:l.width+"%",height:l.height+"%",opacity:l.opacity,transform:"rotate("+l.rotation+"deg)"};
    const mediaStyle:React.CSSProperties={width:(100+l.cropLeft+l.cropRight)*l.zoom+"%",height:(100+l.cropTop+l.cropBottom)*l.zoom+"%",left:(-(l.cropLeft*l.zoom))+"%",top:(-(l.cropTop*l.zoom))+"%"};
    const cls="compositionLayer "+(l.id===selectedLayerId&&!program?"selected":"");
    const common={className:cls,style,onPointerDown:(e:React.PointerEvent)=>!program&&beginDrag(e,l.id,"move"),onWheel:(e:React.WheelEvent)=>!program&&handleEditorWheel(e),onClick:(e:React.MouseEvent)=>{e.stopPropagation();if(!program)setSelectedLayerId(l.id)}};
    if(l.kind==="text")return <div key={l.id} {...common}><span>{l.text||"TEXT"}</span>{!program&&l.id===selectedLayerId&&<>{["nw","n","ne","e","se","s","sw","w"].map(h=><i key={h} className={"resizeHandle h-"+h} onPointerDown={e=>beginHandle(e,l.id,h)}/>)}</>}</div>;
    if(!media)return <div key={l.id} {...common}><span className="missingLayer">Media missing</span></div>;
    const node=l.kind==="image"?<img style={mediaStyle} src={media.url} alt={media.name}/>:<video style={mediaStyle}
      ref={l.id==="base"?(program?programRef:previewRef):undefined}
      src={media.url} muted={!program||l.id!=="base"||p.muted} autoPlay={program?p.programPlaying:p.previewPlaying} loop={l.id!=="base"} playsInline preload="auto"
      onTimeUpdate={l.id==="base"?(e=>{if(program)setProgramClock(e.currentTarget.currentTime);else setPreviewClock(e.currentTarget.currentTime)}):undefined}
      onLoadedMetadata={l.id==="base"?(e=>{e.currentTarget.currentTime=program?p.programTime:p.previewTime}):undefined}
      onEnded={l.id==="base"?(e=>{if(program)p.onProgramEnded?.();else p.stopPreview()}):undefined}
    />;
    return <div key={l.id} {...common}>{node}{!program&&l.id===selectedLayerId&&<>{["nw","n","ne","e","se","s","sw","w"].map(h=><i key={h} className={"resizeHandle h-"+h} onPointerDown={e=>beginHandle(e,l.id,h)}/>)}</>}</div>
  };

  const composition=(program:boolean)=>{
    const layers=program?p.programLayers:p.previewLayers;
    const base=layers.find(x=>x.id==="base");const cameraActive=p.activeSource==="camera"&&!!p.cameraStream;
  const screenActive=p.activeSource==="screen"&&!!p.screenStream; const newsActive=program&&p.activeSource==="news"&&!!p.newsOnAir;
    return <div className={"composition "+(program&&fadePulse?"programFade":"")} style={program?{"--fade-duration":p.fadeSpeed+"ms"} as React.CSSProperties:undefined} ref={!program?editorRef:null}>
      {!base&&!program&&cameraActive&&<video ref={previewCameraRef} className="compositionCamera" autoPlay muted playsInline/>}{!base&&!program&&screenActive&&<video ref={previewScreenRef} className="compositionCamera" autoPlay muted playsInline/>}{!base&&!program&&p.previewWebUrl&&<iframe ref={previewWebRef} className="compositionWeb" src={p.previewWebUrl} title="Preview Web Source" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>}
      {!base&&program&&cameraActive&&<video ref={programCameraRef} className="compositionCamera" autoPlay muted={!p.programPlaying||p.muted} playsInline/>}{!base&&program&&screenActive&&<video ref={programScreenRef} className="compositionCamera" autoPlay muted={!p.programPlaying||p.muted} playsInline/>}{!base&&program&&p.programWebUrl&&<iframe ref={programWebRef} className="compositionWeb" src={p.programWebUrl} title="Program Web Source" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>}
      {newsActive&&<div className="compositionNews" style={{position:"absolute",inset:0,background:"#07111f",color:"#fff",overflow:"hidden",fontFamily:"Arial,sans-serif"}}>
        {p.newsOnAir?.image&&<img src={p.newsOnAir.image} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.42}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(3,12,25,.97) 0%,rgba(3,12,25,.82) 55%,rgba(3,12,25,.3) 100%)"}}/>
        <div style={{position:"absolute",left:"4%",right:"4%",top:"6%",display:"flex",justifyContent:"space-between",alignItems:"flex-start",textTransform:"uppercase"}}><div><b style={{fontSize:"clamp(16px,2.2vw,34px)",letterSpacing:1}}>CHEMCHEM <i style={{fontStyle:"normal",color:"#d8b4ff"}}>TV KENYA</i></b><div style={{fontSize:"clamp(9px,1vw,16px)",opacity:.75,marginTop:4}}>LIVE NEWSROOM • TRUTH • ACCURACY • FOR YOU</div></div><span style={{background:"#d71920",padding:"7px 12px",borderRadius:4,fontWeight:800,fontSize:"clamp(10px,1vw,16px)"}}>● LIVE NEWS</span></div>
        <div style={{position:"absolute",left:"4%",right:"7%",top:"29%"}}><div style={{fontSize:"clamp(10px,1.1vw,18px)",fontWeight:800,color:"#d8b4ff",letterSpacing:1.5,marginBottom:10}}>{(p.newsOnAir?.category||"KENYA").toUpperCase()} • {p.newsOnAir?.source||"NEWSROOM"}</div><h2 style={{fontSize:"clamp(25px,4vw,64px)",lineHeight:1.04,margin:"0 0 18px",maxWidth:"90%",textShadow:"0 2px 8px #000"}}>{p.newsOnAir?.title}</h2><p style={{fontSize:"clamp(12px,1.45vw,23px)",lineHeight:1.35,maxWidth:"72%",margin:0,color:"rgba(255,255,255,.88)"}}>{p.newsOnAir?.description}</p></div>
        <div style={{position:"absolute",left:0,right:0,bottom:0,background:"rgba(215,25,32,.96)",padding:"10px 4%",fontSize:"clamp(10px,1.1vw,17px)",fontWeight:800,letterSpacing:.4}}>BREAKING / LIVE • {p.newsOnAir?.title}</div>
      </div>}
      {layers.map(l=>renderLayer(l,program))}
      {!base&&!p.previewWebUrl&&!cameraActive&&!screenActive&&!program&&<span className="screenEmpty">BUILD YOUR PREVIEW</span>}
      {!base&&!p.programWebUrl&&!cameraActive&&!screenActive&&!newsActive&&program&&<span className="screenEmpty">PROGRAM STANDBY</span>}
    </div>
  };

  const screen=(program:boolean)=><div className="screenWrap">
    <div className="screenLabel"><b>{program?"PROGRAM":"PREVIEW"}</b><span>{program?(p.programPlaying?"LIVE":"STANDBY"):(p.previewPlaying?"PLAYING":"EDIT MODE")}</span></div>
    <div className="screen">{composition(program)}{program&&p.program&&<div className="liveBadge">{p.programPlaying?"LIVE":"PROGRAM"}</div>}</div>
    <div className="previewControls"><button className="playMain" onClick={program?p.toggleProgram:p.togglePreview}>{program?(p.programPlaying?"Ⅱ Pause":"▶ Play"):(p.previewPlaying?"Ⅱ Pause":"▶ Play")}</button><span>{program?fmt(programClock):fmt(previewClock)}</span><div className="miniMeter"><i className={((program?p.programPlaying:p.previewPlaying)&&!p.muted)?"meterLive":""}/></div><button onClick={()=>p.setMuted(!p.muted)}>{p.muted?"🔇":"🔊"}</button><input type="range" min="0" max="1" step=".01" value={p.volume} onChange={e=>p.setVolume(Number(e.target.value))}/></div>
  </div>;

  return <div className="studioSimple">
    <div className="studioTitle"><div><small>PRODUCTION CONTROL ROOM</small><h1>Studio</h1></div><div className="studioActions"><button onClick={p.togglePreview}>{p.previewPlaying?"Ⅱ PAUSE PREVIEW":"▶ PLAY PREVIEW"}</button><button onClick={p.stopPreview}>■ STOP PREVIEW</button><button className={p.live?"danger take":"take"} onClick={p.toggleLive}>{p.live?"■ STOP LIVE":"● GO LIVE"}</button></div></div>
    <div className="obsTopSimple">{screen(false)}<div className="takeColumn"><button className="cutButton" onClick={()=>{p.setTransition("cut");p.take("cut",previewClock)}}>CUT</button><button className="fadeButton" onClick={()=>{p.setTransition("fade");setFadePulse(true);setTimeout(()=>setFadePulse(false),p.fadeSpeed);p.take("fade",previewClock)}}>FADE</button><select value={p.transition} onChange={e=>p.setTransition(e.target.value as "cut"|"fade")}><option value="cut">Cut</option><option value="fade">Fade</option></select><small>Full Preview → Program</small></div>{screen(true)}</div>

    <div className="studioEditor">
      <div className="editorCanvasPanel panel"><div className="title"><b>PREVIEW EDITOR</b><em>DRAG • RESIZE • LAYER</em></div><div className="editorHint">OBS-style canvas: drag a layer to move it • drag any blue handle to resize/zoom • Ctrl/Cmd + wheel to zoom • Alt/Option-drag to crop • use 👁 to show/hide and 🗑 to delete.</div><div className="editorToolbar"><button onClick={()=>setShowGrid(v=>!v)}>{showGrid?"▦ GRID":"▧ NO GRID"}</button><button onClick={()=>setHandMode(v=>!v)} className={handMode?"active":""}>✋ {handMode?"HAND ON":"HAND"}</button><button onClick={()=>setSnapToGrid(v=>!v)}>{snapToGrid?"🧲 SNAP ON":"🧲 SNAP OFF"}</button><select value={gridSize} onChange={e=>setGridSize(Number(e.target.value))}><option value={2}>2%</option><option value={5}>5%</option><option value={10}>10%</option><option value={20}>20%</option></select><button onClick={()=>setCropMode(v=>!v)} className={cropMode?"active":""}>✂ {cropMode?"CROP MODE":"TRANSFORM"}</button><button onClick={()=>selected&&updateLayer(selected.id,{zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,rotation:0})}>RESET</button><button onClick={()=>selected&&updateLayer(selected.id,{x:0,y:0,width:100,height:100})}>FIT</button><button onClick={()=>selected&&updateLayer(selected.id,{x:5,y:5,width:90,height:90})}>FILL</button><button onClick={fitCanvas}>FIT VIEW</button><button onClick={()=>setCanvasZoom(100)}>100%</button><button onClick={()=>setCanvasZoom(v=>Math.max(60,v-10))}>−</button><button onClick={()=>setCanvasZoom(v=>Math.min(200,v+10))}>+</button><label>CANVAS ZOOM <input type="range" min="60" max="160" value={canvasZoom} onChange={e=>setCanvasZoom(Number(e.target.value))}/><b>{canvasZoom}%</b></label><label>FADE <input type="range" min="200" max="3000" step="100" value={p.fadeSpeed} onChange={e=>p.setFadeSpeed(Number(e.target.value))}/><b>{(p.fadeSpeed/1000).toFixed(1)}s</b></label></div>
        <div className="editorCanvas" onPointerDown={beginCanvasPan} onPointerMove={moveCanvasPan} onPointerUp={endCanvasPan} onPointerCancel={endCanvasPan} onWheel={handleEditorWheel} style={{padding:"8px",overflow:"hidden",cursor:handMode?"grab":"default",touchAction:"none"}}><div className="editorZoomViewport" style={{width:canvasZoom+"%",margin:"0 auto",transform:`translate(${canvasPan.x}px,${canvasPan.y}px)`,transformOrigin:"center center"}}><div className="composition editorComposition" ref={editorRef}>{!p.previewLayers.some(x=>x.id==="base")&&!p.previewWebUrl&&<span className="screenEmpty">SELECT MEDIA TO START</span>}{!p.previewLayers.some(x=>x.id==="base")&&p.previewWebUrl&&<iframe className="compositionWeb" src={p.previewWebUrl} title="Editor Web Source" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>}{p.previewLayers.map(l=>renderLayer(l,false))}</div></div></div>
      </div>
      <div className="editorSide panel">
        <div className="title"><b>LAYERS</b><em>{p.previewLayers.length} LAYERS</em></div>
        <div className="editorLayerList">{[...p.previewLayers].reverse().map(l=><div key={l.id} className={"editorLayerRow "+(selectedLayerId===l.id?"selected":"")} onClick={()=>setSelectedLayerId(l.id)}><button className="layerEye" title={l.visible?"Hide layer":"Show layer"} aria-label={l.visible?"Hide layer":"Show layer"} onClick={e=>{e.stopPropagation();updateLayer(l.id,{visible:!l.visible})}}>{l.visible?"👁":"○"}</button><span>{l.kind==="text"?"T":l.kind==="image"?"▧":"▶"}</span><b title={l.name}>{l.name}</b><small>{l.kind}</small><button className="layerLock" title={l.locked?"Unlock layer":"Lock layer"} aria-label={l.locked?"Unlock layer":"Lock layer"} onClick={e=>{e.stopPropagation();updateLayer(l.id,{locked:!l.locked})}}>{l.locked?"🔒":"🔓"}</button><button className="layerDelete" title={l.id==="base"||!!l.role?"Persistent broadcast layer cannot be deleted":"Delete layer"} aria-label="Delete layer" disabled={l.id==="base"||!!l.role} onClick={e=>{e.stopPropagation();removeLayer(l.id)}}>🗑</button></div>)}</div>
        <div className="editorButtons"><div className="graphicsTitle">BROADCAST GRAPHICS</div><div className="graphicsGrid"><button onClick={()=>addGraphicPreset("lower-third")}>＋ Lower Third</button><button onClick={()=>addGraphicPreset("breaking")}>＋ Breaking</button><button onClick={()=>addGraphicPreset("live")}>＋ LIVE Bug</button><button onClick={()=>addGraphicPreset("ticker")}>＋ Ticker</button></div><button onClick={()=>{const f=p.mediaFiles.find(x=>x.type.startsWith("image/"));if(f)addLayer("image",f);else p.upload()}}>＋ Logo / Image</button><button onClick={()=>{const f=p.mediaFiles.find(x=>x.type.startsWith("video/"));if(f)addLayer("video",f);else p.upload()}}>＋ Video Layer</button><button onClick={()=>{const f=p.mediaFiles.find(x=>x.id===p.channelLogoId)||p.mediaFiles.find(x=>x.type.startsWith("image/"));if(f){const layer:StudioLayer={id:"channel-logo",name:"Channel Logo",kind:"image",mediaId:f.id,x:3,y:3,width:15,height:15,rotation:0,opacity:1,zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,visible:true,locked:true,role:"channel-logo"};p.setPreviewLayers(v=>[...v.filter(x=>x.role!=="channel-logo"),layer]);p.setChannelLogoId(f.id);setSelectedLayerId(layer.id)}}}>＋ Channel Logo</button><button onClick={()=>{const f=p.mediaFiles.find(x=>x.type.startsWith("image/"));if(f){const layer:StudioLayer={id:"show-logo",name:"Show Logo",kind:"image",mediaId:f.id,x:82,y:4,width:15,height:15,rotation:0,opacity:1,zoom:1,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,visible:true,locked:true,role:"show-logo"};p.setPreviewLayers(v=>[...v.filter(x=>x.role!=="show-logo"),layer]);setSelectedLayerId(layer.id)}}}>＋ Show Logo</button><button onClick={()=>addLayer("text")}>＋ Text / Lower Third</button></div>
        {selected&&<div className="properties"><div className="propTitle">SELECTED: {selected.name}</div><label>X <input type="number" min="0" max="100" value={Math.round(selected.x)} onChange={e=>updateLayer(selected.id,{x:Number(e.target.value)})}/></label><label>Y <input type="number" min="0" max="100" value={Math.round(selected.y)} onChange={e=>updateLayer(selected.id,{y:Number(e.target.value)})}/></label><label>W <input type="number" min="5" max="100" value={Math.round(selected.width)} onChange={e=>updateLayer(selected.id,{width:Number(e.target.value)})}/></label><label>H <input type="number" min="5" max="100" value={Math.round(selected.height)} onChange={e=>updateLayer(selected.id,{height:Number(e.target.value)})}/></label><label>Opacity <input type="range" min="0.1" max="1" step=".05" value={selected.opacity} onChange={e=>updateLayer(selected.id,{opacity:Number(e.target.value)})}/></label><label>Zoom <input type="range" min="0.5" max="3" step=".05" value={selected.zoom} onChange={e=>updateLayer(selected.id,{zoom:Number(e.target.value)})}/></label><label>Crop Top <input type="number" min="0" max="80" value={selected.cropTop} onChange={e=>updateLayer(selected.id,{cropTop:Number(e.target.value)})}/></label><label>Crop Right <input type="number" min="0" max="80" value={selected.cropRight} onChange={e=>updateLayer(selected.id,{cropRight:Number(e.target.value)})}/></label><label>Crop Bottom <input type="number" min="0" max="80" value={selected.cropBottom} onChange={e=>updateLayer(selected.id,{cropBottom:Number(e.target.value)})}/></label><label>Crop Left <input type="number" min="0" max="80" value={selected.cropLeft} onChange={e=>updateLayer(selected.id,{cropLeft:Number(e.target.value)})}/></label><label>Rotation <input type="range" min="-180" max="180" value={selected.rotation} onChange={e=>updateLayer(selected.id,{rotation:Number(e.target.value)})}/></label>{selected.kind==="text"&&<label>Text <input value={selected.text||""} onChange={e=>updateLayer(selected.id,{text:e.target.value})}/></label>}<div className="propertyActions"><button onClick={()=>reorder(selected.id,1)}>↑ Forward</button><button onClick={()=>reorder(selected.id,-1)}>↓ Back</button><button onClick={()=>duplicateLayer(selected.id)}>Duplicate</button><button onClick={()=>updateLayer(selected.id,{locked:!selected.locked})}>{selected.locked?"Unlock":"Lock"}</button><button className="removeLayerBtn" onClick={()=>removeLayer(selected.id)}>Delete</button></div></div>}
        <div className="editorMedia"><div className="propTitle">MEDIA FOR LAYERS</div><div className="editorMediaList">{p.mediaFiles.length?p.mediaFiles.map(f=><button key={f.id} onClick={()=>addLayer(f.type.startsWith("image/")?"image":"video",f)}><span>{f.type.startsWith("image/")?"▧":"▶"}</span>{f.name}</button>):<small>No uploaded media yet.</small>}</div></div>
      </div>
    </div>

    <div className="obsBarSimple">
      <div className="panel compact"><div className="title"><b>SCENES</b><button onClick={p.addScene}>＋</button></div>{p.scenes.map(s=><button key={s.id} className={"scene "+(p.activeScene===s.id?"selected":"")} onClick={()=>p.setActiveScene(s.id)}>▣ {s.name}</button>)}</div>
      <div className="panel compact"><div className="title"><b>SOURCES</b><button onClick={p.addSource}>＋</button></div><div className="sourceGrid">{p.sources.map(s=><button key={s.id} className={p.activeSource===s.id?"sourceSelected":""} onClick={()=>{if(s.kind==="Camera"){p.startCamera();return;}if(s.kind==="Screen"){p.startScreenShare();return;}p.setActiveSource(s.id);if(s.kind==="Web"&&s.url)p.selectWeb(s.url)}}>{s.kind==="Camera"?"▣":s.kind==="Screen"?"▥":s.kind==="Image"?"▧":s.kind==="Audio"?"◖":s.kind==="Web"?"◎":s.kind==="Text"?"T":"▶"} {s.name}<b>＋</b></button>)}</div><div className="programSourceButtons"><button onClick={()=>p.switchProgramSource("camera")}>● Camera → PROGRAM</button><button onClick={()=>p.switchProgramSource("screen")}>▥ Screen → PROGRAM</button><button onClick={()=>p.switchProgramSource("news")}>▤ Auto News → PROGRAM</button></div><button className="webSourceButton" onClick={p.addWebSource}>＋ Add Web Browser Source</button>{p.cameraReady&&<div className="cameraControls"><button className="webSourceButton" onClick={p.flipCamera}>🔄 Flip Camera ({p.cameraFacing==="user"?"Front":"Back"})</button><button className="webSourceButton" onClick={p.stopCamera}>■ Stop Camera</button></div>}{p.screenReady&&<div className="cameraControls"><button className="webSourceButton" onClick={p.stopScreenShare}>■ Stop Screen Capture</button></div>}</div>
      <div className="panel compact"><div className="title"><b>MEDIA LIBRARY</b><button onClick={p.upload}>＋ Add</button></div><div className="mediaMini">{p.mediaFiles.length===0?<div className="empty">Add video, image or audio files.</div>:p.mediaFiles.map(f=><button key={f.id} className={"mediaMiniRow "+(p.preview?.id===f.id?"selected":"")} onClick={()=>p.selectMedia(f.id)}><span>{f.type.startsWith("video/")?"▶":f.type.startsWith("image/")?"▧":"♫"}</span><b>{f.name}</b><small>Preview</small><i>▶</i></button>)}</div></div>
      <div className="panel compact"><div className="title"><b>AUDIO MIXER</b><em>{p.muted?"MUTED":"PROGRAM AUDIO • "+Math.round(p.volume*100)+"%"}</em></div><div className="mixerRow"><div className="mixerName"><b>PROGRAM AUDIO</b><span>{p.programPlaying&&!p.muted?"● LIVE":""}</span></div><div className="meter"><i className={p.programPlaying&&!p.muted?"meterLive":""}/></div><div className="volumeLine"><button onClick={()=>p.setMuted(!p.muted)}>{p.muted?"🔇":"🔊"}</button><input aria-label="Program audio volume" type="range" min="0" max="1" step=".01" value={p.volume} onChange={e=>p.setVolume(Number(e.target.value))}/><span>{Math.round(p.volume*100)}%</span></div></div><small className="muted">Preview audio is always muted. Only the Program base source can feed broadcast audio; logo/overlay videos are muted.</small></div>
    </div>
    <div className="lowerStudio"><div className="panel"><div className="title"><b>PLAYLIST / RUN ORDER</b><em>{p.mediaFiles.length} MEDIA</em></div><div className="playlist">{p.mediaFiles.length===0?<div className="empty">Your playlist is empty.</div>:p.mediaFiles.map((f,i)=><div className="playlistRow" key={f.id}><strong>{i+1}</strong><span>{f.type.startsWith("video/")?"▶":f.type.startsWith("image/")?"▧":"♫"}</span><b>{f.name}</b><small>{(f.size/1024/1024).toFixed(1)} MB</small><button onClick={()=>p.selectMedia(f.id)}>Preview</button><button onClick={()=>p.playMedia(f.id)}>▶</button></div>)}</div></div><div className="panel programInfoPanel"><div className="title"><b>PROGRAM INFO</b></div><div className="programInfo"><span>NOW PLAYING</span><b>{p.program?.name||"Standby"}</b><small>{p.program?(p.programPlaying?"● Playing":"Stopped"):"No programme on Program"}</small></div><p className="muted">Preview is your editable canvas. Program only changes when you CUT or FADE the composition.</p></div></div>
  </div>
}
function Playlist({mediaFiles,playlistIds,previewMediaId,selectMedia,playMedia,remove,move,removeFromPlaylist,addToPlaylist,playNow,upload}:{mediaFiles:MediaFile[];playlistIds:string[];previewMediaId:string;selectMedia:(id:string)=>void;playMedia:(id:string)=>void;remove:(id:string)=>void;move:(id:string,dir:number)=>void;removeFromPlaylist:(id:string)=>void;addToPlaylist:(id:string)=>void;playNow:(id:string)=>void;upload:()=>void}){
  const queued=playlistIds.map(id=>mediaFiles.find(f=>f.id===id)).filter(Boolean) as MediaFile[];
  const unqueued=mediaFiles.filter(f=>!playlistIds.includes(f.id));
  return <div className="panel full"><div className="title"><b>PLAYLIST / RUN ORDER</b><em>{queued.length} QUEUED</em><button onClick={upload}>＋ Add Media</button></div>
    <div className="playlistRunHead"><span>ORDER</span><span>MEDIA</span><span>SIZE</span><span>ACTION</span></div>
    <div className="playlist">{queued.length===0?<div className="empty">The run order is empty. Add media below to build the automatic playback queue.</div>:queued.map((f,i)=><div className="playlistRow" key={f.id}><strong>{i+1}</strong><span>{f.type.startsWith("video/")?"▶":f.type.startsWith("image/")?"▧":"♫"}</span><b>{f.name}</b><small>{(f.size/1024/1024).toFixed(1)} MB</small><button onClick={()=>selectMedia(f.id)}>{previewMediaId===f.id?"Selected":"Preview"}</button><button onClick={()=>playNow(f.id)}>▶ NOW</button><button onClick={()=>move(f.id,-1)} disabled={i===0}>↑</button><button onClick={()=>move(f.id,1)} disabled={i===queued.length-1}>↓</button><button onClick={()=>removeFromPlaylist(f.id)}>×</button></div>)}</div>
    <div className="playlistAvailable"><div className="title"><b>AVAILABLE MEDIA</b><em>{unqueued.length} NOT QUEUED</em></div>{unqueued.length===0?<div className="empty">All media is already in the run order.</div>:unqueued.map(f=><div className="playlistAvailableRow" key={f.id}><span>{f.type.startsWith("video/")?"▶":f.type.startsWith("image/")?"▧":"♫"}</span><b>{f.name}</b><small>{(f.size/1024/1024).toFixed(1)} MB</small><button onClick={()=>addToPlaylist(f.id)}>＋ Queue</button><button onClick={()=>playMedia(f.id)}>Preview</button><button onClick={()=>remove(f.id)}>Remove</button></div>)}</div>
    <p className="muted">Items are played in order. When a Program video finishes, the next queued item is started automatically. The queue is saved in this browser; uploaded media files themselves still need cloud/Android storage for persistence across devices.</p>
  </div>
}


function Media({files,selected,select,remove,upload}:{files:MediaFile[];selected:string;select:(id:string)=>void;remove:(id:string)=>void;upload:()=>void}){
  return <div className="panel full"><div className="title"><b>MEDIA LIBRARY</b><button onClick={upload}>＋ Upload Media</button></div>
    <div className="media">{["🎬 Videos","🖼 Images","🎵 Audio","📢 Advertisements","📁 Playlists","🎞 Movies"].map(x=><button key={x} onClick={upload}><b>{x}</b><small>{files.length} files</small></button>)}</div>
    <div className="libraryList">{files.length===0?<div className="empty">No media uploaded yet.</div>:files.map(f=><div className={"libraryItem "+(selected===f.id?"selected":"")} key={f.id} onClick={()=>select(f.id)}><div className="thumb">{f.type.startsWith("image/")?<img src={f.url} alt=""/>:f.type.startsWith("video/")?"▶":"♫"}</div><div><b>{f.name}</b><small>{f.type} • {(f.size/1024/1024).toFixed(1)} MB</small></div><button onClick={e=>{e.stopPropagation();remove(f.id)}}>Remove</button></div>)}</div>
    <p className="muted">Select a file to load it into Preview. It does not replace Program.</p>
  </div>
}

function Schedule({rows,now,auto,setAuto,setRows,add,mediaFiles,playNow,showLogoMap,setShowLogoMap,imageFiles}:{rows:string[][];now:string;auto:boolean;setAuto:(v:boolean)=>void;setRows:(v:string[][])=>void;add:()=>void;mediaFiles:MediaFile[];playNow:(row:string[])=>void;showLogoMap:Record<string,string>;setShowLogoMap:(v:Record<string,string>)=>void;imageFiles:MediaFile[]}){
  const ordered=[...rows].sort((a,b)=>(a[0]||"99:99").localeCompare(b[0]||"99:99"));
  const currentIndex=ordered.findIndex(r=>(r[0]||"")===now);
  const nextIndex=currentIndex>=0?((currentIndex+1)%ordered.length):-1;
  const currentRow=currentIndex>=0?ordered[currentIndex]:null;
  const nextRow=nextIndex>=0&&ordered.length?ordered[nextIndex]:null;
  const update=(i:number,j:number,v:string)=>setRows(rows.map((r,ri)=>ri===i?r.map((x,ci)=>ci===j?v:x):r));
  const remove=(i:number)=>setRows(rows.filter((_,ri)=>ri!==i));
  return <div className="panel full"><div className="title"><b>WEEKLY PROGRAMME SCHEDULE</b><div className="scheduleActions"><em className={auto?"green":""}>{auto?"AUTO ON":"AUTO OFF"}</em><button onClick={()=>setAuto(!auto)}>{auto?"Disable":"Enable"} Automation</button><button onClick={add}>＋ Add Programme</button></div></div>
    <div className="scheduleStatus"><span>CONTROL CLOCK <b>{now||"--:--"}</b></span><span>{currentRow?<><b>ON AIR: {currentRow[1]}</b></>:<b>ON AIR: STANDBY</b>}</span><span>{nextRow?<><b>NEXT: {nextRow[0]} · {nextRow[1]}</b></>:<b>NEXT: --</b>}</span><span>{auto?"Schedule monitoring active":"Manual scheduling"}</span></div>
    <div className="table"><div className="thead"><span>TIME</span><span>PROGRAMME</span><span>SOURCE</span><span>VIDEO / MEDIA</span><span>STATUS</span><span>ACTION</span></div>
    {rows.map((r,i)=><div className={"tr "+(r[0]===now?"current":"")} key={i}><input value={r[0]||""} onChange={e=>update(i,0,e.target.value)}/><input value={r[1]||""} onChange={e=>update(i,1,e.target.value)}/><select value={r[2]||"Video"} onChange={e=>update(i,2,e.target.value)}><option>Camera</option><option>Video</option><option>Auto News</option><option>Advertisement</option><option>Movie</option><option>Web</option></select>
    <select value={r[3]||""} onChange={e=>update(i,3,e.target.value)} disabled={!["Video","Advertisement","Movie"].includes(r[2]||"Video")}><option value="">Select video…</option>{mediaFiles.filter(f=>f.type.startsWith("video/")).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><select value={showLogoMap[r[1]||""]||""} onChange={e=>setShowLogoMap({...showLogoMap,[r[1]||""]:e.target.value})} title="Logo used automatically for this show"><option value="">No show logo</option>{imageFiles.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><em>{r[0]===now?"NOW":"Scheduled"}</em><button onClick={()=>playNow(r)} disabled={!r[3]&&r[2]!=="Auto News"&&r[2]!=="Camera"}>▶ Play Now</button><button onClick={()=>remove(i)}>Remove</button></div>)}</div>
    <p className="muted">Edit times and programme names, assign media where required, then enable AUTO. Camera and Auto News slots can run without a media file; video slots use the selected media. PLAY NOW is available for immediate testing.</p>
  </div>
}

function News({notify}:{notify:(x:string)=>void}){
  const [category,setCategory]=useState("Kenya"); const [source,setSource]=useState("STANDARD KENYA");
  const [autoVoice,setAutoVoice]=useState(true); const [ticker,setTicker]=useState(true); const [refresh,setRefresh]=useState(5);
  const [showLowerThird,setShowLowerThird]=useState(true); const [breaking,setBreaking]=useState(false); const [showClock,setShowClock]=useState(true); const [tickerText,setTickerText]=useState("KENYA • AFRICA • WORLD • SPORTS • BUSINESS • ENTERTAINMENT");
  const [items,setItems]=useState<{title:string;description:string;link:string;published:string;source?:string;image?:string}[]>([]);
  const [clockNow,setClockNow]=useState(new Date());
  const [loading,setLoading]=useState(false); const [selected,setSelected]=useState(0); const [speaking,setSpeaking]=useState(false); const [voiceName,setVoiceName]=useState("en-US-AriaNeural"); const [voiceOptions,setVoiceOptions]=useState<SpeechSynthesisVoice[]>([]); const [voiceEngine,setVoiceEngine]=useState<"kokoro"|"browser">("kokoro"); const audioRef=useRef<HTMLAudioElement|null>(null); const kokoroRef=useRef<any>(null);
  const stripMarkup=(value:string)=>{
    if(!value)return "";
    const box=document.createElement("div");
    box.innerHTML=value;
    return (box.textContent||box.innerText||"").replace(/https?:\/\/\S+/g," ").replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi," ").replace(/\s+/g," ").trim();
  };
  const normalizeNewsText=(value:string)=>{
    return stripMarkup(value)
      .replace(/\b(?:LIVE|BREAKING|WATCH|READ MORE|CLICK HERE)\b/gi," ")
      .replace(/\s*[-–—|•]+\s*/g,". ")
      .replace(/\.{2,}/g,".")
      .replace(/\b([A-Z]{2,})\b/g,(m)=>["UN","UK","US","USA","UAE","EU","BBC","TV"].includes(m)?m.split("").join(" "):m)
      .replace(/\s+/g," ").trim();
  };
  const getEnglishVoices=()=>{
    if(typeof window==="undefined"||!("speechSynthesis" in window))return [];
    return window.speechSynthesis.getVoices().filter(v=>/^en(?:-|$)/i.test(v.lang));
  };
  const chooseAnchorVoice=()=>{
    const voices=getEnglishVoices();
    return voices.find(v=>v.name===voiceName)
      ||voices.find(v=>/Google UK English Female|Google UK English Male/i.test(v.name))
      ||voices.find(v=>/Microsoft (?:David|George|Mark|Ryan|Guy|Jenny|Aria|Sonia|Libby).*(?:English|Natural)|Microsoft.*English.*Natural/i.test(v.name))
      ||voices.find(v=>/^en-GB/i.test(v.lang)&&/male|daniel|george|oliver|arthur/i.test(v.name))
      ||voices.find(v=>/^en-GB/i.test(v.lang))
      ||voices.find(v=>/^en-US/i.test(v.lang))
      ||voices[0];
  };
  const speakWithKokoro=async(item:{title:string;description:string})=>{
    const headline=normalizeNewsText(item.title);
    const description=normalizeNewsText(item.description||"");
    const text=("This is CHEMCHEM TV KENYA News. "+headline+(description?". "+description:"")).replace(/\s+/g," ").trim();
    try{
      setSpeaking(true);
      if(!kokoroRef.current){
        notify("Loading free neural newsroom voice… first load can take a little time.");
        const mod=await import("@met4citizen/headtts");
        const engine=new mod.HeadTTS({
          endpoints:["webgpu","wasm"],
          languages:["en-us"],
          voices:["af_bella"],
          workerModule:"https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/modules/worker-tts.mjs",
          dictionaryURL:"https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/dictionaries/"
        });
        await engine.connect();
        engine.setup({voice:voiceName||"af_bella",language:"en-us",speed:0.95,audioEncoding:"wav"});
        kokoroRef.current=engine;
      }else{
        kokoroRef.current.setup({voice:voiceName||"af_bella",language:"en-us",speed:0.95,audioEncoding:"wav"});
      }
      const messages=await kokoroRef.current.synthesize({input:text});
      const audioMessage=messages.find((m:any)=>m.type==="audio");
      if(!audioMessage?.data)throw new Error("Neural voice generated no audio");
      const data=audioMessage.data;
      let bytes:any=data;
      if(data instanceof ArrayBuffer)bytes=new Uint8Array(data);
      const blob=new Blob([bytes],{type:"audio/wav"});
      if(audioRef.current){audioRef.current.pause();audioRef.current.src="";}
      const url=URL.createObjectURL(blob);
      const audio=new Audio(url);
      audioRef.current=audio;
      audio.onended=()=>{setSpeaking(false);URL.revokeObjectURL(url)};
      audio.onerror=()=>{setSpeaking(false);URL.revokeObjectURL(url);notify("Neural audio playback failed")};
      await audio.play();
      notify("AI NEWS ANCHOR: Free Kokoro Neural Voice");
    }catch(error){
      setSpeaking(false);
      notify(error instanceof Error?error.message:"Free neural voice failed. Refresh and try again.");
    }
  };
  const speakWithBrowser=(item:{title:string;description:string})=>{
    if(typeof window==="undefined"||!("speechSynthesis" in window)){notify("Voice is not supported by this browser");return;}
    window.speechSynthesis.cancel();
    const headline=normalizeNewsText(item.title);
    const description=normalizeNewsText(item.description||"");
    const text=("This is CHEMCHEM TV KENYA News. "+headline+(description?" . "+description:"")).replace(/\s+/g," ").trim();
    const voice=chooseAnchorVoice();
    const chunks=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(x=>x.trim()).filter(Boolean)||[text];
    let index=0;
    setSpeaking(true);
    const speakNext=()=>{
      if(index>=chunks.length){setSpeaking(false);return;}
      const utterance=new SpeechSynthesisUtterance(chunks[index++]);
      if(voice)utterance.voice=voice;
      utterance.lang=voice?.lang||"en-GB";
      utterance.rate=.78; utterance.pitch=.96; utterance.volume=1;
      utterance.onend=speakNext; utterance.onerror=()=>setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    };
    speakNext();
    notify("NEWS ANCHOR: "+(voice?.name||"clear English voice"));
  };
  const speakHeadline=(item:{title:string;description:string})=>{
    if(voiceEngine==="kokoro")speakWithKokoro(item); else speakWithBrowser(item);
  };
  const stopVoice=()=>{if(typeof window!=="undefined"&&"speechSynthesis" in window)window.speechSynthesis.cancel();if(audioRef.current){audioRef.current.pause();audioRef.current.currentTime=0;audioRef.current.src="";}setSpeaking(false)};
  useEffect(()=>{if(typeof window==="undefined"||!("speechSynthesis" in window))return;const load=()=>setVoiceOptions(getEnglishVoices());load();window.speechSynthesis.addEventListener("voiceschanged",load);return()=>window.speechSynthesis.removeEventListener("voiceschanged",load)},[]);
  useEffect(()=>{
    const load=async()=>{setLoading(true);try{const r=await fetch("/api/news?category="+encodeURIComponent(category)+"&source="+encodeURIComponent(source),{cache:"no-store"});const j=await r.json();const nextItems=j.items||[];setItems(nextItems);if(nextItems.length)setTickerText(nextItems.slice(0,4).map((x:{title:string})=>x.title).join(" • "))}catch{notify("News feed connection failed")}finally{setLoading(false)}};
    load();const id=window.setInterval(load,refresh*60000);return()=>{window.clearInterval(id);stopVoice()};
  },[refresh,category,source]);
  useEffect(()=>{if(autoVoice&&items.length)speakHeadline(items[selected%items.length])},[selected,autoVoice,voiceName]);
  useEffect(()=>{
    if(!items.length)return;
    const id=window.setInterval(()=>setSelected(v=>(v+1)%items.length),30000);
    return()=>window.clearInterval(id);
  },[items.length]);
  useEffect(()=>{const id=window.setInterval(()=>setClockNow(new Date()),1000);return()=>window.clearInterval(id)},[]);
  const current=items.length?items[selected%items.length]:null;
  const newsHour=clockNow.getHours();
  const newsDaypart=newsHour<11?"MORNING EDITION":newsHour<17?"DAYTIME EDITION":newsHour<21?"EVENING EDITION":"NIGHT EDITION";
  const newsTheme=newsHour<11?"morning":newsHour<17?"day":newsHour<21?"evening":"night";
  const autoBreaking=!!current&&/\b(breaking|urgent|alert|just in|developing)\b/i.test(current.title);
  const liveBreaking=breaking||autoBreaking;
  const anchorName=newsHour<11?"AMANI KIMANI":newsHour<17?"NIA WAMBUGU":newsHour<21?"DAVID OTIENO":"ZURI MWENDE";
  return <div className="two"><div className="panel">
    <div className="title"><b>AUTO NEWS</b><em className="green">{speaking?"🔊 VOICE ON":"AUTO VOICE"}</em></div>
    <div className={"news newsroom news-"+newsTheme}>
      <div className="newsBackdrop">
        <div className="newsBrand"><span className="newsGlobe">◉</span><strong>CHEMCHEM <i>TV KENYA</i></strong><small>TRUTH • ACCURACY • FOR YOU</small></div>
        <div className="newsEdition"><b>{newsDaypart}</b><span>24/7 LIVE NEWSROOM</span></div>
      </div>
      <div className="newsTopBar"><b>{liveBreaking?"● BREAKING NEWS":"● LIVE NEWS"}</b><span>{category.toUpperCase()}</span><em>CHEMCHEM TV KENYA</em>{showClock&&<time>{clockNow.toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"})}</time>}</div>
      <div className="newsAnchorBar"><span>ANCHOR</span><b>{anchorName}</b><small>{newsDaypart}</small></div>
      <small className="newsCourtesy">COURTESY OF {source}</small>
      <p>{loading?"Loading live headlines…":items.length?items.length+" live headlines loaded from the configured RSS/API reader.":"No live headlines available right now."}</p>
      {current&&<div className="newsHeadline">
        {current.image&&<div className="newsStoryImage"><img src={current.image} alt="" loading="lazy" /></div>}
        <div className="newsStoryContent"><div className="storyTag">{liveBreaking?"BREAKING NEWS":category.toUpperCase()}</div><b>{current.title}</b><small>{current.description}</small><div className="storyMeta"><span>COURTESY OF {current.source||source}</span><span>{current.published?new Date(current.published).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"}):""}</span><a href={current.link} target="_blank" rel="noreferrer">SOURCE ↗</a></div></div></div>}
      {showLowerThird&&current&&<div className="newsLowerThird">
        <div className="lowerTop"><strong>{liveBreaking?"BREAKING NEWS":"CHEMCHEM TV KENYA"}</strong><span>{category.toUpperCase()}</span></div>
        <b>{current.title}</b>
        <small>{current.description||"Live newsroom update"} · COURTESY {source}</small>
      </div>}
      <div className="ticker"><strong>TOP STORIES</strong><div><span>{ticker?tickerText:"Ticker disabled"}</span><span>{ticker?tickerText:"Ticker disabled"}</span></div></div>
      <div className="newsControls"><select value={category} onChange={e=>{const next=e.target.value;setCategory(next);const defaults:Record<string,string>={Kenya:"STANDARD KENYA",Africa:"BBC WORLD",World:"BBC WORLD",Sports:"BBC SPORT",Business:"STANDARD BUSINESS",Entertainment:"STANDARD ENTERTAINMENT",Weather:"OPEN-METEO WEATHER"};setSource(defaults[next]||"STANDARD KENYA")}}>{["Kenya","Africa","World","Sports","Business","Entertainment","Weather"].map(x=><option key={x}>{x}</option>)}</select>
      <select value={source} onChange={e=>setSource(e.target.value)}>{["STANDARD KENYA","STANDARD POLITICS","STANDARD BUSINESS","STANDARD ENTERTAINMENT","STANDARD WORLD","BBC WORLD","BBC SPORT","STANDARD SPORTS","OPEN-METEO WEATHER"].map(x=><option key={x}>{x}</option>)}</select>
      <label><input type="checkbox" checked={autoVoice} onChange={e=>setAutoVoice(e.target.checked)}/> AUTO VOICE</label><label><input type="checkbox" checked={ticker} onChange={e=>setTicker(e.target.checked)}/> TICKER</label><label><input type="checkbox" checked={showLowerThird} onChange={e=>setShowLowerThird(e.target.checked)}/> LOWER THIRDS</label><label><input type="checkbox" checked={breaking} onChange={e=>setBreaking(e.target.checked)}/> BREAKING STYLE</label><label><input type="checkbox" checked={showClock} onChange={e=>setShowClock(e.target.checked)}/> CLOCK</label><input aria-label="Ticker text" value={tickerText} onChange={e=>setTickerText(e.target.value)} /><span>Refresh {refresh} min</span><select value={voiceEngine} onChange={e=>{const v=e.target.value as "kokoro"|"browser";setVoiceEngine(v);setVoiceName(v==="kokoro"?"af_bella":"")}}><option value="kokoro">Kokoro Neural AI — FREE</option><option value="browser">Browser Voice (fallback)</option></select><select value={voiceName} onChange={e=>setVoiceName(e.target.value)}>{voiceEngine==="kokoro" ? <><option value="af_bella">Bella — American Female</option><option value="af_heart">Heart — American Female</option><option value="am_fenrir">Fenrir — American Male</option></> : <><option value="">Best English voice</option>{voiceOptions.map(v=><option key={v.name+"-"+v.lang} value={v.name}>{v.name} ({v.lang})</option>)}</>}</select></div>
    </div>
    <div className="buttons">
      <button onClick={()=>{if(!items.length){notify("No headline available");return}const next=(selected+1)%items.length;setSelected(next);if(autoVoice)speakHeadline(items[next])}}>▶ Next + Read</button>
      <button onClick={()=>current?speakHeadline(current):notify("No headline available")}>🔊 Read Current</button>
      <button onClick={stopVoice}>■ Stop Voice</button>
      <button onClick={async()=>{setLoading(true);try{const r=await fetch("/api/news?category="+encodeURIComponent(category)+"&source="+encodeURIComponent(source),{cache:"no-store"});const j=await r.json();const nextItems=j.items||[];setItems(nextItems);setSelected(0);if(nextItems.length)setTickerText(nextItems.slice(0,4).map((x:{title:string})=>x.title).join(" • "));notify("Loaded "+nextItems.length+" headlines")}catch{notify("News refresh failed")}finally{setLoading(false)}}}>↻ Refresh Now</button>
    </div>
  </div><div className="panel"><div className="title"><b>NEWS SOURCES</b></div>
    {["STANDARD KENYA","STANDARD POLITICS","STANDARD BUSINESS","STANDARD ENTERTAINMENT","STANDARD WORLD","BBC WORLD","BBC SPORT","STANDARD SPORTS","OPEN-METEO WEATHER"].map(s=><div className="health" key={s}><span>{s}</span><b>{source===s?"ACTIVE":"Ready"}</b></div>)}
    <div className="panel" style={{marginTop:12}}><div className="title"><b>NEWS ANCHOR VOICE</b><em>{speaking?"ON AIR":"READY"}</em></div><p className="muted">Professional AI newsroom delivery. Free Kokoro Neural speech runs in the browser using WebGPU with WASM fallback. No paid API or account is required. The first use downloads the neural model and voice assets, then the browser caches them.</p><div className="health"><span>VOICE ENGINE</span><b>{voiceEngine==="kokoro"?"Kokoro Neural AI (free/local)":"English browser voices"}</b></div></div>
  </div></div>
}
function Streaming({connected,setConnected,live,program,preview,programWebUrl}:{connected:Record<string,boolean>;setConnected:(v:Record<string,boolean>)=>void;live:boolean;program:MediaFile|null;preview:MediaFile|null;programWebUrl:string}){
  const [autoReconnect,setAutoReconnect]=useState(true);
  const [standby,setStandby]=useState(true);
  const [bitrate,setBitrate]=useState(4500);
  const [fps,setFps]=useState(30);
  const [resolution,setResolution]=useState("1920x1080");
  const [health,setHealth]=useState<"Stable"|"Warning">("Stable");
  const [rtmpServer,setRtmpServer]=useState("");
  const [streamKey,setStreamKey]=useState("");
  const [showKey,setShowKey]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{try{
    const s=localStorage.getItem("dtv-rtmp-server");
    const k=localStorage.getItem("dtv-stream-key");
    const b=localStorage.getItem("dtv-bitrate");
    const f=localStorage.getItem("dtv-fps");
    const q=localStorage.getItem("dtv-resolution");
    if(s)setRtmpServer(s);if(k)setStreamKey(k);if(b)setBitrate(Number(b));if(f)setFps(Number(f));if(q)setResolution(q);
  }catch{}},[]);
  useEffect(()=>{try{
    localStorage.setItem("dtv-rtmp-server",rtmpServer);
    localStorage.setItem("dtv-stream-key",streamKey);
    localStorage.setItem("dtv-bitrate",String(bitrate));
    localStorage.setItem("dtv-fps",String(fps));
    localStorage.setItem("dtv-resolution",resolution);
  }catch{}},[rtmpServer,streamKey,bitrate,fps,resolution]);
  useEffect(()=>{if(!live){setHealth("Stable");return;}const id=window.setInterval(()=>setHealth(navigator.onLine?"Stable":"Warning"),3000);return()=>window.clearInterval(id)},[live]);

  const saveRtmp=()=>{
    setError("");setMessage("");
    if(!rtmpServer.trim()||!streamKey.trim()){setError("Enter both the Facebook Server URL and Stream Key.");return;}
    if(!/^rtmps?:\/\//i.test(rtmpServer.trim())){setError("Server URL must start with rtmp:// or rtmps://.");return;}
    setConnected({...connected,Facebook:true});
    setMessage("Facebook RTMPS destination is configured. The Android engine must now connect to the exact server URL and key.");
  };
  const openAndroidEncoder=()=>{
    setError("");setMessage("");
    if(!live){setError("Start CHEMCHEM TV KENYA ON AIR first.");return;}
    if(!connected.Facebook||!rtmpServer.trim()||!streamKey.trim()){setError("Configure Facebook RTMPS with the current Server URL and Stream Key first.");return;}
    const rawProgramUrl=program?.url||programWebUrl||"";
    const outputUrl=window.location.origin+"/output?"+new URLSearchParams({
      name:program?.name||"CHEMCHEM TV KENYA — PROGRAM",
      src:rawProgramUrl.startsWith("http://")||rawProgramUrl.startsWith("https://")?rawProgramUrl:"",
      kind:programWebUrl?"WEB / YOUTUBE":program?"MEDIA":"STANDBY"
    }).toString();
    const params=new URLSearchParams({
      server:rtmpServer.trim(),
      key:streamKey.trim(),
      program:program?.name||"Standby",
      source:programWebUrl?"Web/YouTube":program?"Media":"Standby",
      webUrl:outputUrl,
      preview:preview?.name||""
    });
    const deepLink="chemchemtv://encoder?"+params.toString();
    setMessage("Opening the CHEMCHEM Android encoder with the current Facebook destination and Program feed.");
    window.location.href=deepLink;
    window.setTimeout(()=>setMessage("If Android did not open, install/update the CHEMCHEM TV KENYA Android app on this same phone and tap OPEN ANDROID ENCODER again."),1200);
  };
  const goLive=()=>openAndroidEncoder();
  const clearDestination=()=>{
    setRtmpServer("");setStreamKey("");setConnected({...connected,Facebook:false});setMessage("Facebook RTMP destination cleared.");setError("");
  };

  return <div className="two">
    <div className="panel">
      <div className="title"><b>STREAMING OUTPUTS</b><em>{live?"PROGRAM READY":"STANDBY"}</em></div>
      <div className="panel">
        <div className="title"><b>FACEBOOK RTMPS</b><em>{connected.Facebook?"CONFIGURED":"READY"}</em></div>
        <p className="muted">Use Facebook Live Producer's <b>Streaming software</b> option. Facebook provides a Server URL and Stream Key. CHEMCHEM sends the encoded program directly to that RTMPS destination — no OBS and no Facebook account login inside CHEMCHEM.</p>
        <label>Facebook Server URL<input value={rtmpServer} onChange={e=>setRtmpServer(e.target.value)} placeholder="rtmps://live-api-s.facebook.com:443/rtmp/"/></label>
        <label>Facebook Stream Key<input type={showKey?"text":"password"} value={streamKey} onChange={e=>setStreamKey(e.target.value)} placeholder="Paste the current Facebook stream key"/></label>
        <label><input type="checkbox" checked={showKey} onChange={e=>setShowKey(e.target.checked)}/> Show stream key</label>
        <div className="buttons">
          <button className={connected.Facebook?"connectedButton":""} onClick={saveRtmp}>{connected.Facebook?"✓ FACEBOOK RTMPS CONFIGURED":"CONNECT FACEBOOK RTMPS"}</button>
          <button onClick={clearDestination}>CLEAR</button>
        </div>
        {message&&<p className="muted">✓ {message}</p>}
        {error&&<p style={{color:"#ff6b78"}}>⚠ {error}</p>}
      </div>

      <div className="streamControls" style={{marginTop:12}}>
        <label>Resolution <select value={resolution} onChange={e=>setResolution(e.target.value)}><option>1920x1080</option><option>1280x720</option></select></label>
        <label>Frame rate <select value={fps} onChange={e=>setFps(Number(e.target.value))}><option value={30}>30 FPS</option><option value={25}>25 FPS</option><option value={60}>60 FPS</option></select></label>
        <label>Target bitrate <input type="range" min="1500" max="9000" step="500" value={bitrate} onChange={e=>setBitrate(Number(e.target.value))}/><b>{bitrate} kbps</b></label>
        <label><input type="checkbox" checked={autoReconnect} onChange={e=>setAutoReconnect(e.target.checked)}/> Automatic reconnect</label>
        <label><input type="checkbox" checked={standby} onChange={e=>setStandby(e.target.checked)}/> Standby fallback</label>
      </div>

      <div className="panel" style={{marginTop:12}}>
        <div className="title"><b>CHEMCHEM BROADCAST ENGINE</b><em>{connected.Facebook?(live?"DESTINATION READY":"CONNECTED"):"READY"}</em></div>
        <p className="muted">OPEN ANDROID ENCODER now sends the real Facebook Server URL, Stream Key and current Program information to the installed CHEMCHEM TV KENYA Android encoder. The Android encoder is the component that creates H.264/AAC and sends RTMPS.</p>
        <div className="health"><span>PREVIEW</span><b>{preview?.name||"STANDBY"}</b></div>
        <div className="health"><span>PROGRAM TO STREAM</span><b>{programWebUrl?"WEB / YOUTUBE":program?.name||"STANDBY"}</b></div>
        <div className="health"><span>FACEBOOK DESTINATION</span><b>{connected.Facebook?"READY FOR ANDROID":"NOT CONFIGURED"}</b></div>
        <div className="buttons"><button onClick={openAndroidEncoder} className="big">OPEN ANDROID ENCODER</button></div>
        <p className="muted">For the Android handoff to work, this control room must be opened on the same Android phone that has the CHEMCHEM TV KENYA encoder installed. Desktop browsers cannot launch an app on a different phone.</p>
      </div>
    </div>

    <div className="panel">
      <div className="title"><b>RTMP ENGINE STATUS</b></div>
      <p>✓ Preview feed · {preview?.name||"STANDBY"}</p>
      <p>✓ Program feed · {programWebUrl?"WEB / YOUTUBE":program?.name||"STANDBY"}</p>
      <p>✓ Facebook RTMPS · {connected.Facebook?"CONFIGURED":"NOT CONFIGURED"}</p>
      <p>✓ Encoder configuration · {rtmpServer&&streamKey?"READY":"WAITING"}</p>
      <p>✓ Automatic reconnect · {autoReconnect?"ON":"OFF"}</p>
      <p>✓ Internet-loss detection · {health}</p>
      <p>✓ Standby fallback · {standby?"ON":"OFF"}</p>
      <p>✓ Target · {resolution} · {fps} FPS · {bitrate} kbps</p>
      <div className="health"><span>RTMP delivery</span><b>{connected.Facebook?"ANDROID ENCODER REQUIRED":"OFFLINE"}</b></div>
      <p className="muted">Facebook's Live Producer page must remain open for the current broadcast. Start the CHEMCHEM Android encoder after pasting the current Server URL and Stream Key. Facebook should then show the incoming preview. Facebook Live Producer (facebook.com/live/producer)</p>
      <p className="muted">If the Android app reports CONNECTION FAILED, use the exact error shown there; the system will no longer label a failed connection as LIVE.</p>
    </div>
  </div>
}
function Analytics({live,program,streamStartedAt,totalViews,peakViewers,connected}:{live:boolean;program:MediaFile|null;streamStartedAt:number|null;totalViews:number;peakViewers:number;connected:Record<string,boolean>}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id)},[]);
  const duration=streamStartedAt?Math.max(0,Math.floor((now-streamStartedAt)/1000)):0;const fmt=(s:number)=>String(Math.floor(s/3600)).padStart(2,"0")+":"+String(Math.floor(s%3600/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");const outputs=Object.values(connected).filter(Boolean).length;return <div><div className="cards">{[["Live Viewers",live?"1":"0"],["Total Views",String(totalViews)],["Program",program?.name||"Standby"],["Followers","—"],["Peak Viewers",String(peakViewers)],["Health",live?"Stable":"Standby"],["Stream Time",fmt(duration)],["Outputs",String(outputs)]].map(x=><div className="metric" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>{live?"Live now":"Today"}</span></div>)}</div><div className="panel" style={{marginTop:12}}><div className="title"><b>OUTPUT HEALTH</b></div>{Object.entries(connected).map(([name,on])=><div className="health" key={name}><span>{name}</span><b>{on?(live?"LIVE":"READY"):"OFFLINE"}</b></div>)}</div></div>
}

function Settings({notify}:{notify:(x:string)=>void}){
  return <div className="panel full"><div className="title"><b>SYSTEM SETTINGS</b></div><div className="settings"><button onClick={()=>notify("Broadcast Engine settings opened")}>Broadcast Engine</button><button onClick={()=>notify("Cloud Media settings opened")}>Cloud Media</button><button onClick={()=>notify("Platform authentication opened")}>Platform Accounts</button><button onClick={()=>notify("Failsafe settings opened")}>Failsafe & Recovery</button></div><p className="muted">Preview and Program remain separated for safe broadcasting. The browser control room handles studio, automation, newsroom, media, scheduling and broadcast graphics, while the CHEMCHEM Android engine handles real-time encoding and delivery.</p></div>
}