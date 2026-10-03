"use client";

import {useEffect,useRef,useState} from "react";
type Section="studio"|"playlist"|"schedule"|"news"|"media"|"streaming"|"analytics"|"settings";
type MediaFile={id:string;name:string;type:string;url:string;size:number};
type Scene={id:string;name:string};
type Source={id:string;name:string;kind:string;mediaId?:string;url?:string;visible:boolean};
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
  {id:"main",name:"Main"},{id:"classroom",name:"Classroom"},{id:"sports",name:"Sports"},
  {id:"news",name:"News"},{id:"events",name:"Events"}
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
  ["07:00","Morning Jolly Show","Camera"],["10:00","Morning News","Auto News"],
  ["11:15","Upishi Bora","Video"],["13:00","Habari Mchana","Auto News"],
  ["15:50","Movie","Video"],["18:00","Habari Jioni","Auto News"],
  ["20:00","Entertainment Show","Video"],["22:00","Movie 1","Video"]
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
  const [previewTime,setPreviewTime]=useState(0);
  const [programTime,setProgramTime]=useState(0);
  const [volume,setVolume]=useState(1);
  const [muted,setMuted]=useState(false);
  const [transition,setTransition]=useState<"cut"|"fade">("cut");
  const [toast,setToast]=useState("");
  const [connected,setConnected]=useState<Record<string,boolean>>({YouTube:false,Facebook:false,TikTok:false,"Custom RTMP":false});
  const [schedule,setSchedule]=useState<string[][]>(seedSchedule);
  const fileInputRef=useRef<HTMLInputElement>(null);

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
    if(!previewMedia&&!previewWebUrl){
      notify("Select and play a media item in Preview first");
      return;
    }
    setProgramMediaId(previewMedia?.id||"");
    setProgramWebUrl(youtubeEmbedUrl(previewWebUrl)||previewWebUrl);
    setProgramPlaying(previewWebUrl?true:previewPlaying);
    setProgramTime(time);
    setTransition(mode);
    notify(mode==="fade"?"FADE to Program":"CUT to Program");
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

  const addProgramme=()=>{
    const name=prompt("Programme name","New Programme");
    if(!name?.trim())return;
    const time=prompt("Start time (HH:MM)","12:00")||"12:00";
    setSchedule(v=>[...v,[time,name.trim(),"Video"]].sort((a,b)=>a[0].localeCompare(b[0])));
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
        setVolume={setVolume} setMuted={setMuted} togglePreview={togglePreview} stopPreview={stopPreview}
        toggleProgram={toggleProgram} take={take} transition={transition} setTransition={setTransition} live={live} toggleLive={toggleLive}
        scenes={scenes} activeScene={activeScene} setActiveScene={setActiveScene} addScene={addScene}
        sources={sources} activeSource={activeSource} setActiveSource={setActiveSource} addSource={addSource} addWebSource={addWebSource}
        mediaFiles={mediaFiles} selectMedia={selectMedia} playMedia={playMedia} selectWeb={(url)=>{setPreviewMediaId("");setPreviewWebUrl(url);setPreviewPlaying(false);notify("Web page loaded into Preview")}} upload={()=>fileInputRef.current?.click()}
      />}
      {section==="playlist"&&<Playlist mediaFiles={mediaFiles} previewMediaId={previewMediaId} selectMedia={selectMedia} remove={removeMedia} upload={()=>fileInputRef.current?.click()}/>}
      {section==="schedule"&&<Schedule rows={schedule} add={addProgramme}/>}
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
  previewTime:number;programTime:number;volume:number;muted:boolean;setVolume:(v:number)=>void;setMuted:(v:boolean)=>void;
  togglePreview:()=>void;stopPreview:()=>void;toggleProgram:()=>void;take:(mode?:"cut"|"fade",time?:number)=>void;transition:"cut"|"fade";setTransition:(v:"cut"|"fade")=>void;
  live:boolean;toggleLive:()=>void;scenes:Scene[];activeScene:string;setActiveScene:(v:string)=>void;addScene:()=>void;
  sources:Source[];activeSource:string;setActiveSource:(v:string)=>void;addSource:()=>void;addWebSource:()=>void;
  mediaFiles:MediaFile[];selectMedia:(id:string)=>void;playMedia:(id:string)=>void;selectWeb:(url:string)=>void;upload:()=>void;
}){
  const previewRef=useRef<HTMLVideoElement>(null);
  const programRef=useRef<HTMLVideoElement>(null);
  const previewWebRef=useRef<HTMLIFrameElement>(null);
  const programWebRef=useRef<HTMLIFrameElement>(null);
  const [previewClock,setPreviewClock]=useState(0);
  const [programClock,setProgramClock]=useState(0);
  const [fadePulse,setFadePulse]=useState(false);

  useEffect(()=>{if(previewRef.current)previewRef.current.volume=p.volume},[p.volume,p.preview?.id]);
  useEffect(()=>{if(programRef.current)programRef.current.volume=p.volume},[p.volume,p.program?.id]);

  useEffect(()=>{
    const v=previewRef.current;
    if(!v)return;
    if(p.previewPlaying){v.play().catch(()=>{})}else v.pause();
  },[p.previewPlaying,p.preview?.id]);

  useEffect(()=>{
    const v=programRef.current;
    if(!v)return;
    if(p.programPlaying){v.play().catch(()=>{})}else v.pause();
  },[p.programPlaying,p.program?.id]);

  const fmt=(s:number)=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(Math.floor(s%60)).padStart(2,"0");
  const controlYouTube=(ref:{current:HTMLIFrameElement|null},action:"playVideo"|"pauseVideo")=>{
    ref.current?.contentWindow?.postMessage(JSON.stringify({event:"command",func:action,args:[]}),"*");
  };
  useEffect(()=>{if(p.previewWebUrl&&isYoutubeEmbed(p.previewWebUrl))controlYouTube(previewWebRef,p.previewPlaying?"playVideo":"pauseVideo")},[p.previewPlaying,p.previewWebUrl]);
  useEffect(()=>{if(p.programWebUrl&&isYoutubeEmbed(p.programWebUrl))controlYouTube(programWebRef,p.programPlaying?"playVideo":"pauseVideo")},[p.programPlaying,p.programWebUrl]);

  const screen=(file:MediaFile|null,preview:boolean)=>(
    <div className="screenWrap">
      <div className="screenLabel"><b>{preview?"PREVIEW":"PROGRAM"}</b><span>{preview?(p.previewPlaying?"PLAYING":"READY"):(p.programPlaying?"LIVE":"STANDBY")}</span></div>
      <div className="screen">
        {!file&&!(preview?p.previewWebUrl:p.programWebUrl)&&<span className="screenEmpty">{preview?"SELECT A MEDIA ITEM":"PROGRAM STANDBY"}</span>}
        {(preview?p.previewWebUrl:p.programWebUrl)&&<iframe ref={preview?previewWebRef:programWebRef} className="webFrame" src={preview?p.previewWebUrl:p.programWebUrl} title={preview?"Web Preview":"Live Web Source"} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}
        {file?.type.startsWith("video/")&&<video
          ref={preview?previewRef:programRef} key={file.id} src={file.url} muted={p.muted} preload="auto" playsInline
          onTimeUpdate={e=>{preview?setPreviewClock(e.currentTarget.currentTime):setProgramClock(e.currentTarget.currentTime)}}
          onLoadedMetadata={e=>{e.currentTarget.currentTime=preview?p.previewTime:p.programTime;if(preview)setPreviewClock(p.previewTime);else setProgramClock(p.programTime)}}
          onEnded={()=>{if(preview)p.stopPreview()}}
        />}
        {file?.type.startsWith("image/")&&<img src={file.url} alt={file.name}/>}
        {file?.type.startsWith("audio/")&&<div className="audioScreen"><strong>♫ {file.name}</strong><audio src={file.url} controls autoPlay={!preview&&p.programPlaying}/></div>}
        {!preview&&file&&<div className="liveBadge">{p.programPlaying?"LIVE":"PROGRAM"}</div>}
      </div>
      <div className="previewControls">
        <button className="playMain" onClick={preview?p.togglePreview:p.toggleProgram}>{preview?(p.previewPlaying?"Ⅱ Pause":"▶ Play"):(p.programPlaying?"Ⅱ Pause":"▶ Play")}</button>
        <span>{preview?fmt(previewClock):fmt(programClock)}</span>
        <div className="miniMeter"><i className={((preview?p.previewPlaying:p.programPlaying)&&!p.muted)?"meterLive":""}/></div>
        <button onClick={()=>p.setMuted(!p.muted)}>{p.muted?"🔇":"🔊"}</button>
        <input type="range" min="0" max="1" step=".01" value={p.volume} onChange={e=>p.setVolume(Number(e.target.value))}/>
      </div>
    </div>
  );

  return <div className="studioSimple">
    <div className="studioTitle"><div><small>OBS-STYLE CONTROL ROOM</small><h1>Studio</h1></div><div className="studioActions"><button onClick={p.togglePreview}>{p.previewPlaying?"Ⅱ PAUSE PREVIEW":"▶ PLAY PREVIEW"}</button><button onClick={p.stopPreview}>■ STOP PREVIEW</button><button className={p.live?"danger take":"take"} onClick={p.toggleLive}>{p.live?"■ STOP LIVE":"● GO LIVE"}</button></div></div>

    <div className="obsTopSimple">
      {screen(p.preview,true)}
      <div className="takeColumn">
        <button className="cutButton" onClick={()=>{p.setTransition("cut");p.take()}}>CUT</button>
        <button className="fadeButton" onClick={()=>{p.setTransition("fade");p.take()}}>FADE</button>
        <select value={p.transition} onChange={e=>p.setTransition(e.target.value as "cut"|"fade")}><option value="cut">Cut</option><option value="fade">Fade</option></select>
        <small>Preview → Program</small>
      </div>
      {screen(p.program,false)}
    </div>

    <div className="obsBarSimple">
      <div className="panel compact">
        <div className="title"><b>SCENES</b><button onClick={p.addScene}>＋</button></div>
        {p.scenes.map(s=><button key={s.id} className={"scene "+(p.activeScene===s.id?"selected":"")} onClick={()=>p.setActiveScene(s.id)}>▣ {s.name}</button>)}
      </div>

      <div className="panel compact">
        <div className="title"><b>SOURCES</b><button onClick={p.addSource}>＋</button></div>
        <div className="sourceGrid">{p.sources.map(s=><button key={s.id} className={p.activeSource===s.id?"sourceSelected":""} onClick={()=>{p.setActiveSource(s.id);if(s.kind==="Web"&&s.url){p.selectWeb(s.url)}}}>{s.kind==="Camera"?"▣":s.kind==="Image"?"▧":s.kind==="Audio"?"◖":s.kind==="Web"?"◎":s.kind==="Text"?"T":"▶"} {s.name}<b>＋</b></button>)}</div>
        <button className="webSourceButton" onClick={p.addWebSource}>＋ Add Web Browser Source</button>
      </div>

      <div className="panel compact">
        <div className="title"><b>MEDIA LIBRARY</b><button onClick={p.upload}>＋ Add</button></div>
        <div className="mediaMini">{p.mediaFiles.length===0?<div className="empty">Add a video, image or audio file.</div>:p.mediaFiles.map(f=><button key={f.id} className={"mediaMiniRow "+(p.preview?.id===f.id?"selected":"")} onClick={()=>p.selectMedia(f.id)}><span>{f.type.startsWith("video/")?"▶":f.type.startsWith("image/")?"▧":"♫"}</span><b>{f.name}</b><small>Preview</small><i>▶</i></button>)}</div>
      </div>

      <div className="panel compact">
        <div className="title"><b>AUDIO MIXER</b><em>{p.muted?"MUTED":Math.round(p.volume*100)+"%"}</em></div>
        {["Desktop Audio","Mic / Aux","Video Audio","Media Audio"].map((x,i)=><div className="mixerRow" key={x}><div className="mixerName"><b>{x}</b><span>{i===2&&p.previewPlaying?"●":""}</span></div><div className="meter"><i className={p.previewPlaying&&!p.muted?"meterLive":""}/></div><div className="volumeLine"><button onClick={()=>p.setMuted(!p.muted)}>{p.muted?"🔇":"🔊"}</button><input type="range" min="0" max="1" step=".01" value={p.volume} onChange={e=>p.setVolume(Number(e.target.value))}/><span>{Math.round(p.volume*100)}%</span></div></div>)}
      </div>
    </div>

    <div className="lowerStudio">
      <div className="panel">
        <div className="title"><b>PLAYLIST / RUN ORDER</b><em>{p.mediaFiles.length} MEDIA</em></div>
        <div className="playlist">{p.mediaFiles.length===0?<div className="empty">Your playlist is empty.</div>:p.mediaFiles.map((f,i)=><div className="playlistRow" key={f.id}><strong>{i+1}</strong><span>{f.type.startsWith("video/")?"▶":"♫"}</span><b>{f.name}</b><small>{(f.size/1024/1024).toFixed(1)} MB</small><button onClick={()=>p.selectMedia(f.id)}>Preview</button><button onClick={()=>p.playMedia(f.id)}>▶</button></div>)}</div>
      </div>
      <div className="panel programInfoPanel"><div className="title"><b>PROGRAM INFO</b></div><div className="programInfo"><span>NOW PLAYING</span><b>{p.program?.name||"Standby"}</b><small>{p.program?(p.programPlaying?"● Playing":"Stopped"):"No programme on Program"}</small></div><p className="muted">Selecting or adding another video only changes Preview. Program stays untouched until CUT or FADE.</p></div>
    </div>
  </div>
}

function Playlist({mediaFiles,previewMediaId,selectMedia,playMedia,remove,upload}:{mediaFiles:MediaFile[];previewMediaId:string;selectMedia:(id:string)=>void;playMedia:(id:string)=>void;remove:(id:string)=>void;upload:()=>void}){
  return <div className="panel full"><div className="title"><b>PLAYLIST / RUN ORDER</b><button onClick={upload}>＋ Add Media</button></div><div className="playlist">{mediaFiles.length===0?<div className="empty">Upload videos to build the run order.</div>:mediaFiles.map((f,i)=><div className="playlistRow" key={f.id}><strong>{i+1}</strong><span>{f.type.startsWith("video/")?"▶":"♫"}</span><b>{f.name}</b><small>{(f.size/1024/1024).toFixed(1)} MB</small><button onClick={()=>selectMedia(f.id)}>{previewMediaId===f.id?"Selected":"Preview"}</button><button onClick={()=>playMedia(f.id)}>▶ Play</button><button onClick={()=>remove(f.id)}>×</button></div>)}</div></div>
}

function Media({files,selected,select,remove,upload}:{files:MediaFile[];selected:string;select:(id:string)=>void;remove:(id:string)=>void;upload:()=>void}){
  return <div className="panel full"><div className="title"><b>MEDIA LIBRARY</b><button onClick={upload}>＋ Upload Media</button></div><div className="media">{["🎬 Videos","🖼 Images","🎵 Audio","📢 Advertisements","📁 Playlists","🎞 Movies"].map(x=><button key={x} onClick={upload}><b>{x}</b><small>{files.length} files</small></button>)}</div><div className="libraryList">{files.length===0?<div className="empty">No media uploaded yet.</div>:files.map(f=><div className={"libraryItem "+(selected===f.id?"selected":"")} key={f.id} onClick={()=>select(f.id)}><div className="thumb">{f.type.startsWith("image/")?<img src={f.url} alt=""/>:f.type.startsWith("video/")?"▶":"♫"}</div><div><b>{f.name}</b><small>{f.type} • {(f.size/1024/1024).toFixed(1)} MB</small></div><button onClick={e=>{e.stopPropagation();remove(f.id)}}>Remove</button></div>)}</div><p className="muted">Select a file to load it into Preview. It does not replace Program.</p></div>
}

function Schedule({rows,add}:{rows:string[][];add:()=>void}){return <div className="panel full"><div className="title"><b>WEEKLY PROGRAMME SCHEDULE</b><button onClick={add}>＋ Add Programme</button></div><div className="table"><div className="thead"><span>TIME</span><span>PROGRAMME</span><span>SOURCE</span><span>STATUS</span></div>{rows.map(r=><div className="tr" key={r.join("-")}><span>{r[0]}</span><b>{r[1]}</b><span>{r[2]}</span><em>Scheduled</em></div>)}</div></div>}

function News({notify}:{notify:(x:string)=>void}){return <div className="two"><div className="panel"><div className="title"><b>AUTO NEWS</b><em className="green">AUTO VOICE</em></div><div className="news"><small>COURTESY OF CONFIGURED SOURCE</small><h2>Automated broadcast news</h2><p>Approved RSS/API feeds can be collected, summarized, attributed and prepared for broadcast.</p><div className="ticker">KENYA • AFRICA • WORLD • SPORTS • BUSINESS • ENTERTAINMENT</div></div><div className="buttons"><button onClick={()=>notify("News test started")}>▶ Test News</button><button onClick={()=>notify("News source setup opened")}>＋ Add News Source</button><button onClick={()=>notify("Voice settings opened")}>⚙ Voice Settings</button></div></div><div className="panel"><div className="title"><b>NEWS SOURCES</b></div>{["TUKO NEWS","STANDARD MEDIA","GDELT / GLOBAL","Custom RSS / API"].map(s=><div className="health" key={s}><span>{s}</span><b>Ready</b></div>)}</div></div>}

function Streaming({connected,setConnected,live}:{connected:Record<string,boolean>;setConnected:(v:Record<string,boolean>)=>void;live:boolean}){return <div className="two"><div className="panel"><div className="title"><b>STREAMING OUTPUTS</b></div>{Object.keys(connected).map(x=><div className="dest" key={x}><div><b>{x}</b><small>{connected[x]?"Connected":"Not connected"}</small></div><button onClick={()=>setConnected({...connected,[x]:!connected[x]})}>{connected[x]?"Disconnect":"Connect"}</button></div>)}<button className="big" onClick={()=>alert(!live?"Start GO LIVE first":"Multi-destination broadcast started")}>GO LIVE TO ALL CONNECTED DESTINATIONS</button></div><div className="panel"><div className="title"><b>FAILSAFE</b></div><p>✓ Automatic reconnect</p><p>✓ Internet-loss detection</p><p>✓ Standby fallback</p><p>✓ Watchdog recovery</p></div></div>}

function Analytics({live,program}:{live:boolean;program:MediaFile|null}){return <div className="cards">{[["Live Viewers",live?"1":"0"],["Total Views",live?"1":"0"],["Program",program?.name||"Standby"],["Followers","0"],["Peak Viewers",live?"1":"0"],["Health",live?"Stable":"Standby"]].map(x=><div className="metric" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>Today</span></div>)}</div>}

function Settings({notify}:{notify:(x:string)=>void}){return <div className="panel full"><div className="title"><b>SYSTEM SETTINGS</b></div><div className="settings"><button onClick={()=>notify("Broadcast Engine settings opened")}>Broadcast Engine</button><button onClick={()=>notify("Cloud Media settings opened")}>Cloud Media</button><button onClick={()=>notify("Platform authentication opened")}>Platform Accounts</button><button onClick={()=>notify("Failsafe settings opened")}>Failsafe & Recovery</button></div><p className="muted">OBS-style control is now separated into Preview and Program. Real platform credentials, cloud storage and Android publishing will be connected in later stages.</p></div>}
