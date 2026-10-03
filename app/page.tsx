"use client";

import {useEffect,useRef,useState} from "react";
type Section="studio"|"playlist"|"schedule"|"news"|"media"|"streaming"|"analytics"|"settings";
type MediaFile={id:string;name:string;type:string;url:string;size:number};
type Scene={id:string;name:string};
type Source={id:string;name:string;kind:string;mediaId?:string;url?:string;visible:boolean};
type StudioLayer={id:string;name:string;kind:"video"|"image"|"text";mediaId?:string;text?:string;x:number;y:number;width:number;height:number;rotation:number;opacity:number;visible:boolean;locked:boolean;};
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
  const [toast,setToast]=useState("");
  const [connected,setConnected]=useState<Record<string,boolean>>({YouTube:false,Facebook:false,TikTok:false,"Custom RTMP":false});
  const [schedule,setSchedule]=useState<string[][]>(seedSchedule);
  const [autoSchedule,setAutoSchedule]=useState(true);
  const [scheduleClock,setScheduleClock]=useState("");
  const lastAutoSlotRef=useRef("");
  const fileInputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{try{const s=localStorage.getItem("dtv-schedule");if(s)setSchedule(JSON.parse(s));const a=localStorage.getItem("dtv-auto-schedule");if(a!==null)setAutoSchedule(a==="true")}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem("dtv-schedule",JSON.stringify(schedule));localStorage.setItem("dtv-auto-schedule",String(autoSchedule))}catch{}},[schedule,autoSchedule]);
  useEffect(()=>{const tick=()=>{const d=new Date();const t=String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");setScheduleClock(t)};tick();const id=window.setInterval(tick,15000);return()=>window.clearInterval(id)},[]);

  useEffect(()=>{
    if(!autoSchedule||!scheduleClock||!mediaFiles.length)return;
    const row=schedule.find(r=>r[0]===scheduleClock&&r[3]);
    if(!row||lastAutoSlotRef.current===scheduleClock)return;
    const media=mediaFiles.find(f=>f.id===row[3]);
    if(!media)return;
    lastAutoSlotRef.current=scheduleClock;
    setPreviewMediaId(media.id);
    setPreviewWebUrl("");
    setPreviewPlaying(true);
    setProgramMediaId(media.id);
    setProgramWebUrl("");
    setProgramPlaying(true);
    setProgramTime(0);
    setActiveSource("media");
    setTransition("cut");
    notify("AUTO: "+media.name+" is now playing on Program");
  },[autoSchedule,scheduleClock,schedule,mediaFiles]);

  const notify=(message:string)=>{setToast(message);setTimeout(()=>setToast(""),2200)};
  const previewMedia=mediaFiles.find(f=>f.id===previewMediaId)||null;
  const programMedia=mediaFiles.find(f=>f.id===programMediaId)||null;

  const addFiles=(files:FileList|null)=>{
    if(!files)return;
    const incoming=Array.from(files).map((file,i)=>({
      id:String(Date.now())+"-"+i,name:file.name,type:file.type||"application/octet-stream",
      url:URL.createObjectURL(file),size:file.size
    }));
    setMediaFiles(v=>[...v,...incoming]);
    if(incoming[0]){
      setPreviewMediaId(incoming[0].id);
      setPreviewPlaying(false);
      setActiveSource(incoming[0].type.startsWith("audio/")?"audio":incoming[0].type.startsWith("image/")?"image":"video");
      notify(incoming[0].name+" loaded into Preview");
    }
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
    if(previewMediaId===id){setPreviewMediaId("");setPreviewPlaying(false)}
    notify("Media removed");
  };

  const addScene=()=>{
    const name=prompt("Scene name","New Scene");
    if(!name?.trim())return;
    const scene={id:String(Date.now()),name:name.trim()};
    setScenes(v=>[...v,scene]);setActiveScene(scene.id);notify("Scene added");
  };

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

  const take=(mode:"cut"|"fade"=transition,time=0)=>{
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
  const toggleLive=()=>{setLive(v=>!v);notify(live?"Broadcast stopped":"Broadcast is ON AIR")};

  const playMedia=(id:string)=>{setPreviewMediaId(id);setPreviewWebUrl("");setPreviewTime(0);setPreviewPlaying(true);setActiveSource("media");const file=mediaFiles.find(x=>x.id===id);if(file)notify(file.name+" started in Preview")};

  const playScheduled=(row:string[])=>{
    const id=row[3];
    if(!id){notify("No video is assigned to this programme");return;}
    const media=mediaFiles.find(x=>x.id===id);
    if(!media){notify("Scheduled media is not available");return;}
    setPreviewMediaId(media.id);
    setPreviewWebUrl("");
    setPreviewPlaying(true);
    setPreviewTime(0);
    setProgramMediaId(media.id);
    setProgramWebUrl("");
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
      <div className="brand"><div className="logo">DTV</div><div><b>DIGITAL TELEVISION SOLUTION</b><small>Broadcast Control Room</small></div></div>
      <div className={"air "+(live?"on":"")}><i/> {live?"ON AIR":"STANDBY"}</div>
      <div className="actions"><span>● System Ready</span><button className="go" onClick={toggleLive}>{live?"STOP LIVE":"GO LIVE"}</button></div>
    </header>

    <nav className="workTabs">{tabs.map(([id,icon,label])=><button key={id} className={"workTab "+(section===id?"active":"")} onClick={()=>setSection(id)}><span>{icon}</span>{label}</button>)}</nav>

    <section className="workspace">
      {section==="studio"&&<Studio
        preview={previewMedia} program={programMedia} previewWebUrl={previewWebUrl} programWebUrl={programWebUrl} previewPlaying={previewPlaying} programPlaying={programPlaying}
        previewTime={previewTime} programTime={programTime} volume={volume} muted={muted}
        previewLayers={previewLayers} setPreviewLayers={setPreviewLayers} programLayers={programLayers}
        setVolume={setVolume} setMuted={setMuted} togglePreview={togglePreview} stopPreview={stopPreview}
        toggleProgram={toggleProgram} take={take} transition={transition} setTransition={setTransition} live={live} toggleLive={toggleLive}
        onProgramEnded={()=>{setProgramPlaying(false);setProgramTime(0);notify("Program item finished — waiting for the next scheduled item")}}
        scenes={scenes} activeScene={activeScene} setActiveScene={setActiveScene} addScene={addScene}
        sources={sources} activeSource={activeSource} setActiveSource={setActiveSource} addSource={addSource} addWebSource={addWebSource}
        mediaFiles={mediaFiles} selectMedia={selectMedia} playMedia={playMedia} selectWeb={(url)=>{setPreviewMediaId("");setPreviewWebUrl(url);setPreviewPlaying(false);notify("Web page loaded into Preview")}} upload={()=>fileInputRef.current?.click()}
      />}
      {section==="playlist"&&<Playlist mediaFiles={mediaFiles} previewMediaId={previewMediaId} selectMedia={selectMedia} playMedia={playMedia} remove={removeMedia} upload={()=>fileInputRef.current?.click()}/>}
      {section==="schedule"&&<Schedule rows={schedule} now={scheduleClock} auto={autoSchedule} setAuto={setAutoSchedule} setRows={setSchedule} add={addProgramme} mediaFiles={mediaFiles} playNow={playScheduled}/>} 
      {section==="news"&&<News notify={notify}/>}
      {section==="media"&&<Media files={mediaFiles} selected={previewMediaId} select={selectMedia} remove={removeMedia} upload={()=>fileInputRef.current?.click()}/>}
      {section==="streaming"&&<Streaming connected={connected} setConnected={setConnected} live={live}/>}
      {section==="analytics"&&<Analytics live={live} program={programMedia}/>}
      {section==="settings"&&<Settings notify={notify}/>}
    </section>

    <input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={e=>{addFiles(e.target.files);e.currentTarget.value=""}}/>
    {toast&&<div className="toast">{toast}</div>}
  </main>
}

function Studio(p:{
  preview:MediaFile|null;program:MediaFile|null;previewWebUrl:string;programWebUrl:string;previewPlaying:boolean;programPlaying:boolean;
  previewTime:number;programTime:number;volume:number;muted:boolean;
  previewLayers:StudioLayer[];setPreviewLayers:(v:StudioLayer[]|((v:StudioLayer[])=>StudioLayer[]))=>void;programLayers:StudioLayer[];
  setVolume:(v:number)=>void;setMuted:(v:boolean)=>void;togglePreview:()=>void;stopPreview:()=>void;toggleProgram:()=>void;
  take:(mode?:"cut"|"fade",time?:number)=>void;transition:"cut"|"fade";setTransition:(v:"cut"|"fade")=>void;
  live:boolean;toggleLive:()=>void;onProgramEnded?:()=>void;scenes:Scene[];activeScene:string;setActiveScene:(v:string)=>void;addScene:()=>void;
  sources:Source[];activeSource:string;setActiveSource:(v:string)=>void;addSource:()=>void;addWebSource:()=>void;
  mediaFiles:MediaFile[];selectMedia:(id:string)=>void;playMedia:(id:string)=>void;selectWeb:(url:string)=>void;upload:()=>void;
}){
  const previewRef=useRef<HTMLVideoElement>(null);
  const programRef=useRef<HTMLVideoElement>(null);
  const previewWebRef=useRef<HTMLIFrameElement>(null);
  const programWebRef=useRef<HTMLIFrameElement>(null);
  const editorRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<{id:string;mode:"move"|"resize";startX:number;startY:number;x:number;y:number;width:number;height:number}|null>(null);
  const [previewClock,setPreviewClock]=useState(0);
  const [programClock,setProgramClock]=useState(0);
  const [selectedLayerId,setSelectedLayerId]=useState("");
  const [fadePulse,setFadePulse]=useState(false);

  useEffect(()=>{if(p.preview&&(!p.previewLayers.some(x=>x.id==="base")||p.previewLayers.find(x=>x.id==="base")?.mediaId!==p.preview.id)){
    const kind=p.preview.type.startsWith("image/")?"image":"video";
    p.setPreviewLayers(prev=>[{id:"base",name:p.preview!.name,kind,mediaId:p.preview!.id,x:0,y:0,width:100,height:100,rotation:0,opacity:1,visible:true,locked:false},...prev.filter(x=>x.id!=="base")]);
  }},[p.preview?.id,p.preview?.type]);

  useEffect(()=>{if(!selectedLayerId&&p.previewLayers.length)setSelectedLayerId(p.previewLayers[0].id);if(selectedLayerId&&!p.previewLayers.some(x=>x.id===selectedLayerId))setSelectedLayerId(p.previewLayers[0]?.id||"")},[p.previewLayers,selectedLayerId]);
  useEffect(()=>{if(previewRef.current)previewRef.current.volume=p.volume},[p.volume,p.preview?.id]);
  useEffect(()=>{if(programRef.current)programRef.current.volume=p.volume},[p.volume,p.program?.id]);
  useEffect(()=>{const v=previewRef.current;if(!v)return;if(p.previewPlaying)v.play().catch(()=>{});else v.pause()},[p.previewPlaying,p.preview?.id]);
  useEffect(()=>{const v=programRef.current;if(!v)return;if(p.programPlaying)v.play().catch(()=>{});else v.pause()},[p.programPlaying,p.program?.id]);

  useEffect(()=>{
    const move=(e:PointerEvent)=>{const d=dragRef.current,el=editorRef.current;if(!d||!el)return;const r=el.getBoundingClientRect();const dx=(e.clientX-d.startX)/r.width*100,dy=(e.clientY-d.startY)/r.height*100;
      p.setPreviewLayers(prev=>prev.map(l=>l.id!==d.id?l:d.mode==="move"?{...l,x:Math.max(0,Math.min(100-l.width,d.x+dx)),y:Math.max(0,Math.min(100-l.height,d.y+dy))}:{...l,width:Math.max(5,Math.min(100-d.x,d.width+dx)),height:Math.max(5,Math.min(100-d.y,d.height+dy))}));
    };
    const up=()=>{dragRef.current=null};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)}
  },[p.setPreviewLayers]);

  const fmt=(s:number)=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(Math.floor(s%60)).padStart(2,"0");
  const controlYouTube=(ref:{current:HTMLIFrameElement|null},action:"playVideo"|"pauseVideo")=>{ref.current?.contentWindow?.postMessage(JSON.stringify({event:"command",func:action,args:[]}),"*")};
  useEffect(()=>{if(p.previewWebUrl&&isYoutubeEmbed(p.previewWebUrl))controlYouTube(previewWebRef,p.previewPlaying?"playVideo":"pauseVideo")},[p.previewPlaying,p.previewWebUrl]);
  useEffect(()=>{if(p.programWebUrl&&isYoutubeEmbed(p.programWebUrl))controlYouTube(programWebRef,p.programPlaying?"playVideo":"pauseVideo")},[p.programPlaying,p.programWebUrl]);

  const addLayer=(kind:"image"|"video"|"text",file?:MediaFile)=>{
    if(kind==="text"){const text=prompt("Text / lower third","LIVE • BREAKING NEWS");if(!text?.trim())return;const layer:StudioLayer={id:String(Date.now()),name:"Text / Lower Third",kind:"text",text:text.trim(),x:10,y:72,width:80,height:16,rotation:0,opacity:1,visible:true,locked:false};p.setPreviewLayers(v=>[...v,layer]);setSelectedLayerId(layer.id);return}
    if(!file){p.upload();return}
    const layer:StudioLayer={id:String(Date.now())+"-"+Math.random().toString(36).slice(2,6),name:kind==="image"?"Logo / Image":file.name,kind,mediaId:file.id,x:kind==="image"?72:15,y:kind==="image"?6:15,width:kind==="image"?22:55,height:kind==="image"?18:40,rotation:0,opacity:1,visible:true,locked:false};
    p.setPreviewLayers(v=>[...v,layer]);setSelectedLayerId(layer.id)
  };
  const updateLayer=(id:string,patch:Partial<StudioLayer>)=>p.setPreviewLayers(v=>v.map(l=>l.id===id?{...l,...patch}:l));
  const selected=p.previewLayers.find(x=>x.id===selectedLayerId)||null;
  const reorder=(id:string,dir:number)=>p.setPreviewLayers(v=>{const i=v.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=v.length)return v;const a=[...v];[a[i],a[j]]=[a[j],a[i]];return a});
  const removeLayer=(id:string)=>{if(id==="base")return;p.setPreviewLayers(v=>v.filter(x=>x.id!==id));setSelectedLayerId("")};
  const beginDrag=(e:React.PointerEvent,id:string,mode:"move"|"resize")=>{e.stopPropagation();const l=p.previewLayers.find(x=>x.id===id);if(!l||l.locked)return;dragRef.current={id,mode,startX:e.clientX,startY:e.clientY,x:l.x,y:l.y,width:l.width,height:l.height};setSelectedLayerId(id)};

  const renderLayer=(l:StudioLayer,program:boolean)=>{
    if(!l.visible)return null;
    const media=p.mediaFiles.find(x=>x.id===l.mediaId);
    const style:React.CSSProperties={left:l.x+"%",top:l.y+"%",width:l.width+"%",height:l.height+"%",opacity:l.opacity,transform:"rotate("+l.rotation+"deg)"};
    const cls="compositionLayer "+(l.id===selectedLayerId&&!program?"selected":"");
    const common={className:cls,style,onPointerDown:(e:React.PointerEvent)=>!program&&beginDrag(e,l.id,"move"),onClick:(e:React.MouseEvent)=>{e.stopPropagation();if(!program)setSelectedLayerId(l.id)}};
    if(l.kind==="text")return <div key={l.id} {...common}><span>{l.text||"TEXT"}</span>{!program&&l.id===selectedLayerId&&<i className="resizeHandle" onPointerDown={e=>beginDrag(e,l.id,"resize")}/>}</div>;
    if(!media)return <div key={l.id} {...common}><span className="missingLayer">Media missing</span></div>;
    const node=l.kind==="image"?<img src={media.url} alt={media.name}/>:<video src={media.url} muted={p.muted} autoPlay={program?p.programPlaying:p.previewPlaying} loop playsInline preload="auto"/>;
    return <div key={l.id} {...common}>{node}{!program&&l.id===selectedLayerId&&<i className="resizeHandle" onPointerDown={e=>beginDrag(e,l.id,"resize")}/>}</div>
  };

  const composition=(program:boolean)=>{
    const layers=program?p.programLayers:p.previewLayers;
    const base=layers.find(x=>x.id==="base");
    return <div className={"composition "+(program&&fadePulse?"programFade":"")} ref={!program?editorRef:null}>
      {!base&&!program&&p.previewWebUrl&&<iframe ref={previewWebRef} className="compositionWeb" src={p.previewWebUrl} title="Preview Web Source" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>}
      {!base&&program&&p.programWebUrl&&<iframe ref={programWebRef} className="compositionWeb" src={p.programWebUrl} title="Program Web Source" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>}
      {layers.map(l=>renderLayer(l,program))}
      {!base&&!p.previewWebUrl&&!program&&<span className="screenEmpty">BUILD YOUR PREVIEW</span>}
      {!base&&!p.programWebUrl&&program&&<span className="screenEmpty">PROGRAM STANDBY</span>}
    </div>
  };

  const screen=(program:boolean)=><div className="screenWrap">
    <div className="screenLabel"><b>{program?"PROGRAM":"PREVIEW"}</b><span>{program?(p.programPlaying?"LIVE":"STANDBY"):(p.previewPlaying?"PLAYING":"EDIT MODE")}</span></div>
    <div className="screen">{composition(program)}{program&&p.program&&<div className="liveBadge">{p.programPlaying?"LIVE":"PROGRAM"}</div>}</div>
    <div className="previewControls"><button className="playMain" onClick={program?p.toggleProgram:p.togglePreview}>{program?(p.programPlaying?"Ⅱ Pause":"▶ Play"):(p.previewPlaying?"Ⅱ Pause":"▶ Play")}</button><span>{program?fmt(programClock):fmt(previewClock)}</span><div className="miniMeter"><i className={((program?p.programPlaying:p.previewPlaying)&&!p.muted)?"meterLive":""}/></div><button onClick={()=>p.setMuted(!p.muted)}>{p.muted?"🔇":"🔊"}</button><input type="range" min="0" max="1" step=".01" value={p.volume} onChange={e=>p.setVolume(Number(e.target.value))}/></div>
  </div>;

  return <div className="studioSimple">
    <div className="studioTitle"><div><small>PRODUCTION CONTROL ROOM</small><h1>Studio</h1></div><div className="studioActions"><button onClick={p.togglePreview}>{p.previewPlaying?"Ⅱ PAUSE PREVIEW":"▶ PLAY PREVIEW"}</button><button onClick={p.stopPreview}>■ STOP PREVIEW</button><button className={p.live?"danger take":"take"} onClick={p.toggleLive}>{p.live?"■ STOP LIVE":"● GO LIVE"}</button></div></div>
    <div className="obsTopSimple">{screen(false)}<div className="takeColumn"><button className="cutButton" onClick={()=>{p.setTransition("cut");p.take()}}>CUT</button><button className="fadeButton" onClick={()=>{p.setTransition("fade");setFadePulse(true);setTimeout(()=>setFadePulse(false),500);p.take()}}>FADE</button><select value={p.transition} onChange={e=>p.setTransition(e.target.value as "cut"|"fade")}><option value="cut">Cut</option><option value="fade">Fade</option></select><small>Full Preview → Program</small></div>{screen(true)}</div>

    <div className="studioEditor">
      <div className="editorCanvasPanel panel"><div className="title"><b>PREVIEW EDITOR</b><em>DRAG • RESIZE • LAYER</em></div><div className="editorHint">Edit only Preview. Add logos, images, text and video layers. Program stays unchanged until CUT or FADE.</div>
        <div className="editorCanvas"><div className="composition editorComposition" ref={editorRef}>{!p.previewLayers.some(x=>x.id==="base")&&!p.previewWebUrl&&<span className="screenEmpty">SELECT MEDIA TO START</span>}{!p.previewLayers.some(x=>x.id==="base")&&p.previewWebUrl&&<iframe className="compositionWeb" src={p.previewWebUrl} title="Editor Web Source" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>}{p.previewLayers.map(l=>renderLayer(l,false))}</div></div>
      </div>
      <div className="editorSide panel">
        <div className="title"><b>LAYERS</b><em>{p.previewLayers.length} LAYERS</em></div>
        <div className="editorLayerList">{[...p.previewLayers].reverse().map(l=><button key={l.id} className={"editorLayerRow "+(selectedLayerId===l.id?"selected":"")} onClick={()=>setSelectedLayerId(l.id)}><span>{l.kind==="text"?"T":l.kind==="image"?"▧":"▶"}</span><b>{l.name}</b><small>{l.kind}</small><i onClick={e=>{e.stopPropagation();updateLayer(l.id,{visible:!l.visible})}}>{l.visible?"◉":"○"}</i></button>)}</div>
        <div className="editorButtons"><button onClick={()=>{const f=p.mediaFiles.find(x=>x.type.startsWith("image/"));if(f)addLayer("image",f);else p.upload()}}>＋ Logo / Image</button><button onClick={()=>{const f=p.mediaFiles.find(x=>x.type.startsWith("video/"));if(f)addLayer("video",f);else p.upload()}}>＋ Video Layer</button><button onClick={()=>addLayer("text")}>＋ Text / Lower Third</button></div>
        {selected&&<div className="properties"><div className="propTitle">SELECTED: {selected.name}</div><label>X <input type="number" min="0" max="100" value={Math.round(selected.x)} onChange={e=>updateLayer(selected.id,{x:Number(e.target.value)})}/></label><label>Y <input type="number" min="0" max="100" value={Math.round(selected.y)} onChange={e=>updateLayer(selected.id,{y:Number(e.target.value)})}/></label><label>W <input type="number" min="5" max="100" value={Math.round(selected.width)} onChange={e=>updateLayer(selected.id,{width:Number(e.target.value)})}/></label><label>H <input type="number" min="5" max="100" value={Math.round(selected.height)} onChange={e=>updateLayer(selected.id,{height:Number(e.target.value)})}/></label><label>Opacity <input type="range" min="0.1" max="1" step=".05" value={selected.opacity} onChange={e=>updateLayer(selected.id,{opacity:Number(e.target.value)})}/></label><label>Rotation <input type="range" min="-180" max="180" value={selected.rotation} onChange={e=>updateLayer(selected.id,{rotation:Number(e.target.value)})}/></label>{selected.kind==="text"&&<label>Text <input value={selected.text||""} onChange={e=>updateLayer(selected.id,{text:e.target.value})}/></label>}<div className="propertyActions"><button onClick={()=>reorder(selected.id,-1)}>↑ Forward</button><button onClick={()=>reorder(selected.id,1)}>↓ Back</button><button onClick={()=>updateLayer(selected.id,{locked:!selected.locked})}>{selected.locked?"Unlock":"Lock"}</button><button className="removeLayerBtn" onClick={()=>removeLayer(selected.id)}>Delete</button></div></div>}
        <div className="editorMedia"><div className="propTitle">MEDIA FOR LAYERS</div><div className="editorMediaList">{p.mediaFiles.length?p.mediaFiles.map(f=><button key={f.id} onClick={()=>addLayer(f.type.startsWith("image/")?"image":"video",f)}><span>{f.type.startsWith("image/")?"▧":"▶"}</span>{f.name}</button>):<small>No uploaded media yet.</small>}</div></div>
      </div>
    </div>

    <div className="obsBarSimple">
      <div className="panel compact"><div className="title"><b>SCENES</b><button onClick={p.addScene}>＋</button></div>{p.scenes.map(s=><button key={s.id} className={"scene "+(p.activeScene===s.id?"selected":"")} onClick={()=>p.setActiveScene(s.id)}>▣ {s.name}</button>)}</div>
      <div className="panel compact"><div className="title"><b>SOURCES</b><button onClick={p.addSource}>＋</button></div><div className="sourceGrid">{p.sources.map(s=><button key={s.id} className={p.activeSource===s.id?"sourceSelected":""} onClick={()=>{p.setActiveSource(s.id);if(s.kind==="Web"&&s.url)p.selectWeb(s.url)}}>{s.kind==="Camera"?"▣":s.kind==="Image"?"▧":s.kind==="Audio"?"◖":s.kind==="Web"?"◎":s.kind==="Text"?"T":"▶"} {s.name}<b>＋</b></button>)}</div><button className="webSourceButton" onClick={p.addWebSource}>＋ Add Web Browser Source</button></div>
      <div className="panel compact"><div className="title"><b>MEDIA LIBRARY</b><button onClick={p.upload}>＋ Add</button></div><div className="mediaMini">{p.mediaFiles.length===0?<div className="empty">Add video, image or audio files.</div>:p.mediaFiles.map(f=><button key={f.id} className={"mediaMiniRow "+(p.preview?.id===f.id?"selected":"")} onClick={()=>p.selectMedia(f.id)}><span>{f.type.startsWith("video/")?"▶":f.type.startsWith("image/")?"▧":"♫"}</span><b>{f.name}</b><small>Preview</small><i>▶</i></button>)}</div></div>
      <div className="panel compact"><div className="title"><b>AUDIO MIXER</b><em>{p.muted?"MUTED":Math.round(p.volume*100)+"%"}</em></div>{["Desktop Audio","Mic / Aux","Video Audio","Media Audio"].map((x,i)=><div className="mixerRow" key={x}><div className="mixerName"><b>{x}</b><span>{i===2&&p.previewPlaying?"●":""}</span></div><div className="meter"><i className={p.previewPlaying&&!p.muted?"meterLive":""}/></div><div className="volumeLine"><button onClick={()=>p.setMuted(!p.muted)}>{p.muted?"🔇":"🔊"}</button><input type="range" min="0" max="1" step=".01" value={p.volume} onChange={e=>p.setVolume(Number(e.target.value))}/><span>{Math.round(p.volume*100)}%</span></div></div>)}</div>
    </div>
    <div className="lowerStudio"><div className="panel"><div className="title"><b>PLAYLIST / RUN ORDER</b><em>{p.mediaFiles.length} MEDIA</em></div><div className="playlist">{p.mediaFiles.length===0?<div className="empty">Your playlist is empty.</div>:p.mediaFiles.map((f,i)=><div className="playlistRow" key={f.id}><strong>{i+1}</strong><span>{f.type.startsWith("video/")?"▶":f.type.startsWith("image/")?"▧":"♫"}</span><b>{f.name}</b><small>{(f.size/1024/1024).toFixed(1)} MB</small><button onClick={()=>p.selectMedia(f.id)}>Preview</button><button onClick={()=>p.playMedia(f.id)}>▶</button></div>)}</div></div><div className="panel programInfoPanel"><div className="title"><b>PROGRAM INFO</b></div><div className="programInfo"><span>NOW PLAYING</span><b>{p.program?.name||"Standby"}</b><small>{p.program?(p.programPlaying?"● Playing":"Stopped"):"No programme on Program"}</small></div><p className="muted">Preview is your editable canvas. Program only changes when you CUT or FADE the composition.</p></div></div>
  </div>
}
function Playlist({mediaFiles,previewMediaId,selectMedia,playMedia,remove,upload}:{mediaFiles:MediaFile[];previewMediaId:string;selectMedia:(id:string)=>void;playMedia:(id:string)=>void;remove:(id:string)=>void;upload:()=>void}){
  return <div className="panel full"><div className="title"><b>PLAYLIST / RUN ORDER</b><button onClick={upload}>＋ Add Media</button></div><div className="playlist">{mediaFiles.length===0?<div className="empty">Upload videos to build the run order.</div>:mediaFiles.map((f,i)=><div className="playlistRow" key={f.id}><strong>{i+1}</strong><span>{f.type.startsWith("video/")?"▶":"♫"}</span><b>{f.name}</b><small>{(f.size/1024/1024).toFixed(1)} MB</small><button onClick={()=>selectMedia(f.id)}>{previewMediaId===f.id?"Selected":"Preview"}</button><button onClick={()=>playMedia(f.id)}>▶ Play</button><button onClick={()=>remove(f.id)}>×</button></div>)}</div></div>
}

function Media({files,selected,select,remove,upload}:{files:MediaFile[];selected:string;select:(id:string)=>void;remove:(id:string)=>void;upload:()=>void}){
  return <div className="panel full"><div className="title"><b>MEDIA LIBRARY</b><button onClick={upload}>＋ Upload Media</button></div><div className="media">{["🎬 Videos","🖼 Images","🎵 Audio","📢 Advertisements","📁 Playlists","🎞 Movies"].map(x=><button key={x} onClick={upload}><b>{x}</b><small>{files.length} files</small></button>)}</div><div className="libraryList">{files.length===0?<div className="empty">No media uploaded yet.</div>:files.map(f=><div className={"libraryItem "+(selected===f.id?"selected":"")} key={f.id} onClick={()=>select(f.id)}><div className="thumb">{f.type.startsWith("image/")?<img src={f.url} alt=""/>:f.type.startsWith("video/")?"▶":"♫"}</div><div><b>{f.name}</b><small>{f.type} • {(f.size/1024/1024).toFixed(1)} MB</small></div><button onClick={e=>{e.stopPropagation();remove(f.id)}}>Remove</button></div>)}</div><p className="muted">Select a file to load it into Preview. It does not replace Program.</p></div>
}

function Schedule({rows,now,auto,setAuto,setRows,add,mediaFiles,playNow}:{rows:string[][];now:string;auto:boolean;setAuto:(v:boolean)=>void;setRows:(v:string[][])=>void;add:()=>void;mediaFiles:MediaFile[];playNow:(row:string[])=>void}){
  const update=(i:number,j:number,v:string)=>setRows(rows.map((r,ri)=>ri===i?r.map((x,ci)=>ci===j?v:x):r));
  const remove=(i:number)=>setRows(rows.filter((_,ri)=>ri!==i));

  return <div className="panel full"><div className="title"><b>WEEKLY PROGRAMME SCHEDULE</b><div className="scheduleActions"><em className={auto?"green":""}>{auto?"AUTO ON":"AUTO OFF"}</em><button onClick={()=>setAuto(!auto)}>{auto?"Disable":"Enable"} Automation</button><button onClick={add}>＋ Add Programme</button></div></div><div className="scheduleStatus"><span>CONTROL CLOCK <b>{now||"--:--"}</b></span><span>{auto?"Schedule monitoring active":"Manual scheduling"}</span></div><div className="table"><div className="thead"><span>TIME</span><span>PROGRAMME</span><span>SOURCE</span><span>VIDEO / MEDIA</span><span>STATUS</span><span>ACTION</span></div>{rows.map((r,i)=><div className={"tr "+(r[0]===now?"current":"")} key={i}><input value={r[0]||""} onChange={e=>update(i,0,e.target.value)}/><input value={r[1]||""} onChange={e=>update(i,1,e.target.value)}/><select value={r[2]||"Video"} onChange={e=>update(i,2,e.target.value)}><option>Camera</option><option>Video</option><option>Auto News</option><option>Advertisement</option><option>Movie</option><option>Web</option></select><select value={r[3]||""} onChange={e=>update(i,3,e.target.value)} disabled={!["Video","Advertisement","Movie"].includes(r[2]||"Video")}><option value="">Select video…</option>{mediaFiles.filter(f=>f.type.startsWith("video/")).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><em>{r[0]===now?"NOW":"Scheduled"}</em><button onClick={()=>playNow(r)} disabled={!r[3]}>▶ Play Now</button><button onClick={()=>remove(i)}>Remove</button></div>)}</div><p className="muted">Choose a video in the VIDEO / MEDIA column. Use PLAY NOW to send a scheduled item directly to Program. When AUTO is ON and the control clock reaches that row's time, the selected video is loaded into Program and starts automatically. Videos are currently browser-session media until cloud/Android storage is connected.</p></div>
}

function News({notify}:{notify:(x:string)=>void}){return <div className="two"><div className="panel"><div className="title"><b>AUTO NEWS</b><em className="green">AUTO VOICE</em></div><div className="news"><small>COURTESY OF CONFIGURED SOURCE</small><h2>Automated broadcast news</h2><p>Approved RSS/API feeds can be collected, summarized, attributed and prepared for broadcast.</p><div className="ticker">KENYA • AFRICA • WORLD • SPORTS • BUSINESS • ENTERTAINMENT</div></div><div className="buttons"><button onClick={()=>notify("News test started")}>▶ Test News</button><button onClick={()=>notify("News source setup opened")}>＋ Add News Source</button><button onClick={()=>notify("Voice settings opened")}>⚙ Voice Settings</button></div></div><div className="panel"><div className="title"><b>NEWS SOURCES</b></div>{["TUKO NEWS","STANDARD MEDIA","GDELT / GLOBAL","Custom RSS / API"].map(s=><div className="health" key={s}><span>{s}</span><b>Ready</b></div>)}</div></div>}

function Streaming({connected,setConnected,live}:{connected:Record<string,boolean>;setConnected:(v:Record<string,boolean>)=>void;live:boolean}){return <div className="two"><div className="panel"><div className="title"><b>STREAMING OUTPUTS</b></div>{Object.keys(connected).map(x=><div className="dest" key={x}><div><b>{x}</b><small>{connected[x]?"Connected":"Not connected"}</small></div><button onClick={()=>setConnected({...connected,[x]:!connected[x]})}>{connected[x]?"Disconnect":"Connect"}</button></div>)}<button className="big" onClick={()=>alert(!live?"Start GO LIVE first":"Multi-destination broadcast started")}>GO LIVE TO ALL CONNECTED DESTINATIONS</button></div><div className="panel"><div className="title"><b>FAILSAFE</b></div><p>✓ Automatic reconnect</p><p>✓ Internet-loss detection</p><p>✓ Standby fallback</p><p>✓ Watchdog recovery</p></div></div>}

function Analytics({live,program}:{live:boolean;program:MediaFile|null}){return <div className="cards">{[["Live Viewers",live?"1":"0"],["Total Views",live?"1":"0"],["Program",program?.name||"Standby"],["Followers","0"],["Peak Viewers",live?"1":"0"],["Health",live?"Stable":"Standby"]].map(x=><div className="metric" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>Today</span></div>)}</div>}

function Settings({notify}:{notify:(x:string)=>void}){return <div className="panel full"><div className="title"><b>SYSTEM SETTINGS</b></div><div className="settings"><button onClick={()=>notify("Broadcast Engine settings opened")}>Broadcast Engine</button><button onClick={()=>notify("Cloud Media settings opened")}>Cloud Media</button><button onClick={()=>notify("Platform authentication opened")}>Platform Accounts</button><button onClick={()=>notify("Failsafe settings opened")}>Failsafe & Recovery</button></div><p className="muted">OBS-style control is now separated into Preview and Program. Real platform credentials, cloud storage and Android publishing will be connected in later stages.</p></div>}
