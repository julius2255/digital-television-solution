"use client";

import {useEffect,useRef,useState} from "react";

type Section="studio"|"schedule"|"news"|"media"|"streaming"|"analytics"|"audience"|"settings";

const sections:[Section,string,string][]=[
  ["studio","🎬","Live Studio"],["schedule","📅","TV Schedule"],["news","📰","Auto News"],
  ["media","🎞","Media Library"],["streaming","📡","Streaming"],["analytics","📊","Analytics"],
  ["audience","👥","Audience & Sharing"],["settings","⚙","Settings"]
];

type Layer={id:string;name:string;kind:string;url?:string;type?:string;visible:boolean};
type MediaFile={id:string;name:string;type:string;url:string;size:number};

const seedSchedule=[
  ["07:00","Morning Jolly Show","Camera"],["10:00","Morning News","Auto News"],
  ["11:15","Upishi Bora","Video"],["13:00","Habari Mchana","Auto News"],
  ["15:50","Movie","Video"],["18:00","Habari Jioni","Auto News"],
  ["20:00","Entertainment Show","Video"],["22:00","Movie 1","Video"]
];

export default function Home(){
  const [section,setSection]=useState<Section>("studio");
  const [live,setLive]=useState(false);
  const [scene,setScene]=useState("Live Camera");
  const [scenes,setScenes]=useState(["Live Camera","Auto News","Advertisement","Movie","Standby"]);
  const [schedule,setSchedule]=useState(seedSchedule);
  const [toast,setToast]=useState("");
  const [connected,setConnected]=useState<Record<string,boolean>>({YouTube:false,Facebook:false,TikTok:false,"Custom RTMP":false});
  const [source,setSource]=useState("Camera");
  const [playing,setPlaying]=useState(false);
  const [elapsed,setElapsed]=useState("00:00:00");
  const [mediaFiles,setMediaFiles]=useState<{id:string;name:string;type:string;url:string;size:number}[]>([]);
  const [selectedMedia,setSelectedMedia]=useState("");
  const [layers,setLayers]=useState<Layer[]>([{id:"camera-base",name:"Live Camera",kind:"Camera",visible:true}]);
  const [selectedLayer,setSelectedLayer]=useState("camera-base");
  const [programLayers,setProgramLayers]=useState<Layer[]>([{id:"camera-base",name:"Live Camera",kind:"Camera",visible:true}]);
  const fileInputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setElapsed(v=>{const p=v.split(":").map(Number);let s=p[0]*3600+p[1]*60+p[2]+1;return [Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(n=>String(n).padStart(2,"0")).join(":")}),1000);return()=>clearInterval(timer)},[playing]);
  useEffect(()=>()=>mediaFiles.forEach(f=>URL.revokeObjectURL(f.url)),[mediaFiles]);

  const notify=(m:string)=>{setToast(m);setTimeout(()=>setToast(""),2500)};
  const toggleLive=()=>{setLive(v=>!v);notify(live?"Broadcast stopped":"Studio is ON AIR")};
  const addScene=()=>{const n=prompt("New scene name");if(n?.trim()){setScenes(v=>[...v,n.trim()]);setScene(n.trim());notify("Scene created")}};
  const addProgramme=()=>{const n=prompt("Programme name");if(!n?.trim())return;const t=prompt("Start time (HH:MM)","12:00")||"12:00";setSchedule(v=>[...v,[t,n.trim(),"Video"]].sort((a,b)=>a[0].localeCompare(b[0])));notify("Programme added")};
  const upload=()=>fileInputRef.current?.click();
  const handleFiles=(files:FileList|null)=>{if(!files)return;const incoming=Array.from(files).map((file,i)=>({id:String(Date.now())+"-"+i,name:file.name,type:file.type||"file",url:URL.createObjectURL(file),size:file.size}));setMediaFiles(v=>[...v,...incoming]);if(incoming[0]){setSelectedMedia(incoming[0].id);selectSource(incoming[0].type.startsWith("image/")?"Image":incoming[0].type.startsWith("audio/")?"Microphone":"Video")}notify(incoming.length+" media file"+(incoming.length===1?"":"s")+" added")};
  const selectMedia=(id:string)=>{const f=mediaFiles.find(x=>x.id===id);if(!f)return;setSelectedMedia(id);selectSource(f.type.startsWith("image/")?"Image":f.type.startsWith("audio/")?"Microphone":"Video");notify(f.name+" ready in Preview — Program continues")};
  const removeMedia=(id:string)=>{setMediaFiles(v=>{const f=v.find(x=>x.id===id);if(f)URL.revokeObjectURL(f.url);return v.filter(x=>x.id!==id)});if(selectedMedia===id)setSelectedMedia("");notify("Media removed")};
  const toggleDestination=(n:string)=>{setConnected(v=>({...v,[n]:!v[n]}));notify((connected[n]?"Disconnected ":"Connected ")+n)};
  const selectSource=(n:string)=>{setSource(n);notify(n+" source selected")};
  const togglePlayback=()=>{setPlaying(v=>!v);notify(playing?"Playback paused":"Playback started")};
  const resetPlayback=()=>{setPlaying(false);setElapsed("00:00:00");notify("Playback reset")};
  const addLayer=()=>{const f=mediaFiles.find(x=>x.id===selectedMedia);const kind=f?(f.type.startsWith("image/")?"Image":f.type.startsWith("audio/")?"Audio":"Video"):source;const layer:Layer={id:String(Date.now()),name:f?.name||kind,kind,url:f?.url,type:f?.type,visible:true};setLayers(v=>[...v,layer]);setSelectedLayer(layer.id);notify(layer.name+" added as layer")};
  const addTextLayer=()=>{const t=prompt("Text to add to preview","DIGITAL TELEVISION");if(t?.trim()){const layer:Layer={id:String(Date.now()),name:t.trim(),kind:"Text",visible:true};setLayers(v=>[...v,layer]);setSelectedLayer(layer.id);notify("Text layer added")}};
  const removeLayer=()=>{if(selectedLayer==="camera-base")return;setLayers(v=>v.filter(x=>x.id!==selectedLayer));setSelectedLayer("camera-base");notify("Layer removed")};
  const toggleLayer=(id:string)=>setLayers(v=>v.map(x=>x.id===id?{...x,visible:!x.visible}:x));
  const cutToProgram=()=>{setProgramLayers(layers.filter(x=>x.visible));notify("Preview sent to Program")};

  return <main className="appOne">
    <header className="topbar"><div className="brand"><div className="logo">DTV</div><div><b>DIGITAL TELEVISION SOLUTION</b><small>Broadcast Control Room</small></div></div><div className={"air "+(live?"on":"")}><i/> {live?"ON AIR":"STANDBY"}</div><div className="actions"><span>● System Ready</span><button className="go" onClick={toggleLive}>{live?"STOP LIVE":"GO LIVE"}</button></div></header>
    <nav className="workTabs">{sections.map(([id,icon,label])=><button key={id} className={section===id?"workTab active":"workTab"} onClick={()=>setSection(id)}><span>{icon}</span>{label.replace("Live ","")}</button>)}</nav>
    <section className="workspace">
      {section==="studio"&&<Studio live={live} toggleLive={toggleLive} playing={playing} togglePlayback={togglePlayback} resetPlayback={resetPlayback} elapsed={elapsed} selectedMedia={mediaFiles.find(f=>f.id===selectedMedia)||null} layers={layers} programLayers={programLayers} addLayer={addLayer} addTextLayer={addTextLayer} removeLayer={removeLayer} toggleLayer={toggleLayer} cutToProgram={cutToProgram}/>}
      {section==="schedule"&&<Schedule rows={schedule} add={addProgramme}/>}
      {section==="news"&&<News notify={notify}/>}
      {section==="media"&&<Media upload={upload} files={mediaFiles} selected={selectedMedia} select={selectMedia} remove={removeMedia} fileInputRef={fileInputRef} onFiles={handleFiles}/>}
      {section==="streaming"&&<Streaming connected={connected} toggle={toggleDestination} live={live}/>}
      {section==="analytics"&&<Analytics live={live}/>}
      {section==="audience"&&<Audience notify={notify}/>}
      {section==="settings"&&<Settings notify={notify}/>}
    </section>
    {toast&&<div className="toast">{toast}</div>}
  </main>
}

function Studio({live,toggleLive,playing,togglePlayback,resetPlayback,elapsed,selectedMedia,layers,programLayers,addLayer,addTextLayer,removeLayer,toggleLayer,cutToProgram}:{live:boolean;toggleLive:()=>void;playing:boolean;togglePlayback:()=>void;resetPlayback:()=>void;elapsed:string;selectedMedia:MediaFile|null;layers:Layer[];programLayers:Layer[];addLayer:()=>void;addTextLayer:()=>void;removeLayer:()=>void;toggleLayer:(x:string)=>void;cutToProgram:()=>void}){
  const [volume,setVolume]=useState(1);
  const [muted,setMuted]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);
  useEffect(()=>{if(videoRef.current)videoRef.current.volume=volume},[volume,selectedMedia?.id]);
  const media=selectedMedia;
  const render=(file:MediaFile|null,label:string,program=false)=><div className="screenWrap"><div className="screenLabel">{label}{!program&&<span>READY</span>}</div><div className="screen">{file?.type.startsWith("video/")?<video ref={!program?videoRef:undefined} key={file.id} src={file.url} autoPlay={program&&playing} muted={muted} controls={false} loop preload="auto" playsInline/>:file?.type.startsWith("image/")?<img src={file.url} alt={file.name}/>:file?.type.startsWith("audio/")?<audio src={file.url} autoPlay={program&&playing} controls preload="auto"/>:<span className="screenEmpty">{program?"PROGRAM STANDBY":"SELECT A MEDIA ITEM"}</span>}{program&&playing&&<div className="liveBadge">LIVE • {elapsed}</div>}</div></div>;
  return <div className="studioSimple">
    <div className="studioTitle"><div><small>OBS-STYLE CONTROL ROOM</small><h1>Studio</h1></div><div className="studioActions"><button onClick={togglePlayback}>{playing?"Ⅱ PAUSE":"▶ PLAY"}</button><button onClick={resetPlayback}>⏹ STOP</button><button className={live?"danger take":"take"} onClick={toggleLive}>{live?"■ STOP LIVE":"● GO LIVE"}</button></div></div>
    <div className="obsTopSimple">{render(media,"PREVIEW")}{<div className="takeColumn"><button onClick={cutToProgram}>TAKE →</button><small>Preview becomes Program instantly</small></div>}{render(programLayers.find(x=>x.visible&&x.url)?.url?{id:programLayers.find(x=>x.visible&&x.url)!.id,name:programLayers.find(x=>x.visible&&x.url)!.name,type:programLayers.find(x=>x.visible&&x.url)!.type||"video/mp4",url:programLayers.find(x=>x.visible&&x.url)!.url!,size:0}:null,"PROGRAM",true)}</div>
    <div className="obsBarSimple">
      <div className="panel compact"><div className="title"><b>MEDIA / NEXT</b><em>{media?"READY":"NONE"}</em></div><p className="muted">{media?media.name:"Choose a video from Media Library."}</p><button className="big" onClick={cutToProgram}>TAKE PREVIEW → PROGRAM</button></div>
      <div className="panel compact"><div className="title"><b>AUDIO MIXER</b><em>{muted?"MUTED":Math.round(volume*100)+"%"}</em></div><div className="mixerMain"><div className="bigMeter"><i className={playing&&!muted?"meterLive":""}/></div><button onClick={()=>setMuted(v=>!v)}>{muted?"🔇":"🔊"}</button><input type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></div></div>
      <div className="panel compact"><div className="title"><b>LAYERS / OVERLAYS</b><em>{layers.length}</em></div>{layers.map(l=><div className="simpleLayer" key={l.id}><button onClick={()=>toggleLayer(l.id)}>{l.visible?"◉":"○"}</button><b>{l.name}</b><small>{l.kind}</small><button onClick={()=>removeLayer(l.id)}>×</button></div>)}<div className="layerButtons"><button onClick={addTextLayer}>＋ Text</button><button onClick={addLayer}>＋ Media</button></div></div>
      <div className="panel compact"><div className="title"><b>PROGRAM STATUS</b></div><div className="programInfo"><span>NOW PLAYING</span><b>{programLayers.find(x=>x.visible)?.name||"Standby"}</b><small>{playing?"Playing":"Stopped"} • {elapsed}</small></div><p className="muted">Adding or selecting another video only changes Preview. The current Program stays running until TAKE.</p></div>
    </div>
    <div className="panel"><div className="title"><b>QUICK SOURCES</b><em>Simple mode</em></div><div className="quickSources"><button onClick={addLayer}>＋ Video / Image</button><button onClick={addTextLayer}>＋ Text</button><button onClick={toggleLive}>● Camera</button><button onClick={()=>setMuted(v=>!v)}>{muted?"🔇 Unmute":"🔊 Mute"}</button></div></div>
  </div>
}

function Schedule({rows,add}:{rows:string[][];add:()=>void}){return <div className="panel full"><div className="title"><b>WEEKLY PROGRAMME SCHEDULE</b><button onClick={add}>＋ Add Programme</button></div><div className="table"><div className="thead"><span>TIME</span><span>PROGRAMME</span><span>SOURCE</span><span>STATUS</span></div>{rows.map(r=><div className="tr" key={r.join("-")}><span>{r[0]}</span><b>{r[1]}</b><span>{r[2]}</span><em>Scheduled</em></div>)}</div><p className="muted">This is the initial editable schedule foundation. The full cloud scheduler will become the source of truth for the Android broadcast engine.</p></div>}

function News({notify}:{notify:(x:string)=>void}){return <div className="two"><div className="panel"><div className="title"><b>AUTO NEWS</b><em className="green">AUTO VOICE</em></div><div className="news"><small>COURTESY OF CONFIGURED SOURCE</small><h2>Automated broadcast news</h2><p>Approved RSS/API feeds will be collected, summarized, attributed and converted to broadcast-ready stories before the next scheduled programme.</p><div className="ticker">KENYA • AFRICA • WORLD • SPORTS • BUSINESS • ENTERTAINMENT</div></div><div className="buttons"><button onClick={()=>notify("News test started")}>▶ Test News</button><button onClick={()=>notify("News source setup opened")}>＋ Add News Source</button><button onClick={()=>notify("Voice settings opened")}>⚙ Voice Settings</button></div></div><div className="panel"><div className="title"><b>NEWS SOURCES</b></div>{["TUKO NEWS","STANDARD MEDIA","GDELT / GLOBAL","Custom RSS / API"].map(s=><div className="health" key={s}><span>{s}</span><b>Ready</b></div>)}</div></div>}

function Media({upload,files,selected,select,remove,fileInputRef,onFiles}:{upload:()=>void;files:{id:string;name:string;type:string;url:string;size:number}[];selected:string;select:(id:string)=>void;remove:(id:string)=>void;fileInputRef:React.RefObject<HTMLInputElement|null>;onFiles:(files:FileList|null)=>void}){return <div className="panel full"><div className="title"><b>MEDIA LIBRARY</b><button onClick={upload}>＋ Upload Media</button></div><input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={e=>{onFiles(e.target.files);e.currentTarget.value=""}}/><div className="media">{["🎬 Movies","📺 TV Shows","📢 Advertisements","🎵 Audio","🖼 Images","📁 Playlists"].map(x=><button key={x} onClick={upload}><b>{x}</b><small>{files.length} files</small></button>)}</div>{files.length===0?<div className="empty">No media yet. Upload videos, images or audio to test the Studio.</div>:<div className="libraryList">{files.map(f=><div className={"libraryItem "+(selected===f.id?"selected":"")} key={f.id} onClick={()=>select(f.id)}><div className="thumb">{f.type.startsWith("image/")?<img src={f.url} alt=""/>:f.type.startsWith("video/")?"🎬":"🎵"}</div><div><b>{f.name}</b><small>{f.type||"file"} • {(f.size/1024/1024).toFixed(1)} MB</small></div><button onClick={e=>{e.stopPropagation();remove(f.id)}}>Remove</button></div>)}</div>}<p className="muted">Browser playback is active for testing. Cloudinary storage and persistent media sync come next.</p></div>}

function Streaming({connected,toggle,live}:{connected:Record<string,boolean>;toggle:(x:string)=>void;live:boolean}){return <div className="two"><div className="panel"><div className="title"><b>STREAMING OUTPUTS</b></div>{Object.keys(connected).map(x=><div className="dest" key={x}><div><b>{x}</b><small>{connected[x]?"Connected":"Not connected"}</small></div><button onClick={()=>toggle(x)}>{connected[x]?"Disconnect":"Connect"}</button></div>)}<button className="big" onClick={()=>{if(!live){alert("Start GO LIVE first");return}if(!Object.values(connected).some(Boolean)){alert("Connect at least one destination first");return}alert("Multi-destination broadcast started")}}>GO LIVE TO ALL CONNECTED DESTINATIONS</button></div><div className="panel"><div className="title"><b>FAILSAFE</b></div><p>✓ Automatic reconnect</p><p>✓ Internet-loss detection</p><p>✓ Standby fallback</p><p>✓ Watchdog recovery</p></div></div>}

function Analytics({live}:{live:boolean}){return <div className="cards">{[["Live Viewers",live?"1":"0"],["Total Views",live?"1":"0"],["Watch Time",live?"00:01":"00:00"],["Followers","0"],["Peak Viewers",live?"1":"0"],["Health",live?"Stable":"Standby"]].map(x=><div className="metric" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>Today</span></div>)}</div>}

function Audience({notify}:{notify:(x:string)=>void}){return <div className="two"><div className="panel"><div className="title"><b>AUDIENCE & SHARING</b><button onClick={()=>notify("Metrics refreshed")}>↻ Refresh</button></div>{["Facebook Pages / Groups","YouTube Communities","TikTok Audience","Other Communities"].map(x=><div className="dest" key={x}><div><b>{x}</b><small>Official API permissions required</small></div><button onClick={()=>notify("Connection setup opened")}>Connect</button></div>)}</div><div className="panel"><div className="title"><b>SHARE MESSAGE</b></div><textarea defaultValue={"🔴 WE ARE LIVE!\n\nJoin us now for the latest programme.\n\nDigital Television Solution 📺"}/><button className="big" onClick={()=>notify("Share message prepared")}>Prepare Share</button></div></div>}

function Settings({notify}:{notify:(x:string)=>void}){return <div className="panel full"><div className="title"><b>SYSTEM SETTINGS</b></div><div className="settings"><button onClick={()=>notify("Broadcast engine settings opened")}>Broadcast Engine</button><button onClick={()=>notify("Cloudinary media settings opened")}>Cloud Media</button><button onClick={()=>notify("Platform authentication opened")}>Platform Accounts</button><button onClick={()=>notify("Failsafe settings opened")}>Failsafe & Recovery</button></div><p className="muted">The system is being rebuilt cleanly. Real streaming credentials, news APIs, Cloudinary storage and Android publishing will be connected in controlled stages.</p></div>}
