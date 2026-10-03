"use client";

import {useEffect, useRef, useState} from "react";

type Section="studio"|"schedule"|"news"|"media"|"streaming"|"analytics"|"audience"|"settings";

const sections:[Section,string,string][]=[
  ["studio","🎬","Live Studio"],["schedule","📅","TV Schedule"],["news","📰","Auto News"],
  ["media","🎞","Media Library"],["streaming","📡","Streaming"],["analytics","📊","Analytics"],
  ["audience","👥","Audience & Sharing"],["settings","⚙","Settings"]
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
  const fileInputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setElapsed(v=>{const p=v.split(":").map(Number);let s=p[0]*3600+p[1]*60+p[2]+1;return [Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(n=>String(n).padStart(2,"0")).join(":")}),1000);return()=>clearInterval(timer)},[playing]);
  useEffect(()=>()=>mediaFiles.forEach(f=>URL.revokeObjectURL(f.url)),[mediaFiles]);

  const notify=(m:string)=>{setToast(m);setTimeout(()=>setToast(""),2500)};
  const toggleLive=()=>{setLive(v=>!v);notify(live?"Broadcast stopped":"Studio is ON AIR")};
  const addScene=()=>{const n=prompt("New scene name");if(n?.trim()){setScenes(v=>[...v,n.trim()]);setScene(n.trim());notify("Scene created")}};
  const addProgramme=()=>{const n=prompt("Programme name");if(!n?.trim())return;const t=prompt("Start time (HH:MM)","12:00")||"12:00";setSchedule(v=>[...v,[t,n.trim(),"Video"]].sort((a,b)=>a[0].localeCompare(b[0])));notify("Programme added")};
  const upload=()=>fileInputRef.current?.click();
  const handleFiles=(files:FileList|null)=>{if(!files)return;const incoming=Array.from(files).map((file,i)=>({id:String(Date.now())+"-"+i,name:file.name,type:file.type||"file",url:URL.createObjectURL(file),size:file.size}));setMediaFiles(v=>[...v,...incoming]);if(incoming[0]){setSelectedMedia(incoming[0].id);selectSource(incoming[0].type.startsWith("image/")?"Image":incoming[0].type.startsWith("audio/")?"Microphone":"Video")}notify(incoming.length+" media file"+(incoming.length===1?"":"s")+" added")};
  const selectMedia=(id:string)=>{const f=mediaFiles.find(x=>x.id===id);if(!f)return;setSelectedMedia(id);selectSource(f.type.startsWith("image/")?"Image":f.type.startsWith("audio/")?"Microphone":"Video");setPlaying(false);setElapsed("00:00:00");notify(f.name+" selected")};
  const removeMedia=(id:string)=>{setMediaFiles(v=>{const f=v.find(x=>x.id===id);if(f)URL.revokeObjectURL(f.url);return v.filter(x=>x.id!==id)});if(selectedMedia===id)setSelectedMedia("");notify("Media removed")};
  const toggleDestination=(n:string)=>{setConnected(v=>({...v,[n]:!v[n]}));notify((connected[n]?"Disconnected ":"Connected ")+n)};
  const selectSource=(n:string)=>{setSource(n);notify(n+" source selected")};
  const togglePlayback=()=>{setPlaying(v=>!v);notify(playing?"Playback paused":"Playback started")};
  const resetPlayback=()=>{setPlaying(false);setElapsed("00:00:00");notify("Playback reset")};

  return <main className="app">
    <aside className="sidebar">
      <div className="brand"><div className="logo">DTV</div><div><b>DIGITAL TELEVISION</b><small>SOLUTION</small></div></div>
      <div className={"air "+(live?"on":"")}><i/> {live?"ON AIR":"OFFLINE"}</div>
      <nav>{sections.map(([id,icon,label])=><button key={id} className={section===id?"nav active":"nav"} onClick={()=>setSection(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sideFoot">Broadcast Control System<br/><small>v1.0 foundation</small></div>
    </aside>
    <section className="main">
      <header><div><small className="eyebrow">DIGITAL TELEVISION SOLUTION</small><h1>{sections.find(x=>x[0]===section)?.[2]}</h1></div><div className="actions"><span>● System Ready</span><button className="go" onClick={toggleLive}>{live?"STOP LIVE":"GO LIVE"}</button></div></header>

      {section==="studio"&&<Studio live={live} scene={scene} setScene={setScene} scenes={scenes} addScene={addScene} source={source} setSource={selectSource} playing={playing} togglePlayback={togglePlayback} resetPlayback={resetPlayback} elapsed={elapsed} selectedMedia={mediaFiles.find(f=>f.id===selectedMedia)||null}/>}
      {section==="schedule"&&<Schedule rows={schedule} add={addProgramme}/>}
      {section==="news"&&<News notify={notify}/>}
      {section==="media"&&<Media upload={upload} files={mediaFiles} selected={selectedMedia} select={selectMedia} remove={removeMedia} fileInputRef={fileInputRef} onFiles={handleFiles}/>}
      {section==="streaming"&&<Streaming connected={connected} toggle={toggleDestination} live={live}/>}
      {section==="analytics"&&<Analytics live={live}/>}
      {section==="audience"&&<Audience notify={notify}/>}
      {section==="settings"&&<Settings notify={notify}/>}

      {toast&&<div className="toast">{toast}</div>}
    </section>
  </main>;
}

function Studio({live,scene,setScene,scenes,addScene,source,setSource,playing,togglePlayback,resetPlayback,elapsed,selectedMedia}:{live:boolean;scene:string;setScene:(x:string)=>void;scenes:string[];addScene:()=>void;source:string;setSource:(x:string)=>void;playing:boolean;togglePlayback:()=>void;resetPlayback:()=>void;elapsed:string;selectedMedia:{name:string;type:string;url:string}|null}){
  const sources=[["📷","Camera"],["🎞","Video"],["🖼","Image"],["🔤","Text"],["🎙","Microphone"],["🌐","Browser"],["📰","Auto News"],["©","Logo"]];
  return <div className="grid studio">
    <div className="panel preview">
      <div className="title"><b>PROGRAM OUTPUT</b><em>{live?"LIVE":"PREVIEW"}</em></div>
      <div className="screen">{selectedMedia&&source==="Video"&&selectedMedia.type.startsWith("video/")?<video src={selectedMedia.url} controls={false} autoPlay={playing} muted playsInline/>:selectedMedia&&source==="Image"&&selectedMedia.type.startsWith("image/")?<img src={selectedMedia.url} alt={selectedMedia.name}/>:selectedMedia&&source==="Microphone"&&selectedMedia.type.startsWith("audio/")?<div className="mediaAudio"><strong>🎵 {selectedMedia.name}</strong><audio src={selectedMedia.url} controls autoPlay={playing}/></div>:<><strong>DIGITAL TELEVISION</strong><span>{live?scene.toUpperCase():"READY TO BROADCAST"}</span><small>{source} • {playing?"PLAYING":"PAUSED"}{selectedMedia?` • ${selectedMedia.name}`:""}</small></>}</div>
      <div className="transport"><button onClick={togglePlayback}>{playing?"Ⅱ":"▶"}</button><button onClick={resetPlayback}>⏹</button><label>{elapsed}</label></div>
    </div>
    <div className="panel"><div className="title"><b>SCENES</b><button onClick={addScene}>＋ New Scene</button></div>{scenes.map(s=><button key={s} onClick={()=>setScene(s)} className={"scene "+(scene===s?"selected":"")}>▣ {s}<small>{scene===s?"ACTIVE":"SELECT"}</small></button>)}</div>
    <div className="panel"><div className="title"><b>SOURCES</b><em>{source.toUpperCase()}</em></div><div className="sourceGrid">{sources.map(([icon,name])=><button className={source===name?"sourceSelected":""} onClick={()=>setSource(name)} key={name}>{icon} {name}</button>)}</div></div>
    <div className="panel"><div className="title"><b>BROADCAST HEALTH</b></div>{[["Connection",live?"Stable":"Standby"],["Bitrate",live?"4.8 Mbps":"0 Mbps"],["Dropped Frames","0.00%"],["Watchdog","Active"]].map(x=><div className="health" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div>
  </div>
}

function Schedule({rows,add}:{rows:string[][];add:()=>void}){return <div className="panel full"><div className="title"><b>WEEKLY PROGRAMME SCHEDULE</b><button onClick={add}>＋ Add Programme</button></div><div className="table"><div className="thead"><span>TIME</span><span>PROGRAMME</span><span>SOURCE</span><span>STATUS</span></div>{rows.map(r=><div className="tr" key={r.join("-")}><span>{r[0]}</span><b>{r[1]}</b><span>{r[2]}</span><em>Scheduled</em></div>)}</div><p className="muted">This is the initial editable schedule foundation. The full cloud scheduler will become the source of truth for the Android broadcast engine.</p></div>}

function News({notify}:{notify:(x:string)=>void}){return <div className="two"><div className="panel"><div className="title"><b>AUTO NEWS</b><em className="green">AUTO VOICE</em></div><div className="news"><small>COURTESY OF CONFIGURED SOURCE</small><h2>Automated broadcast news</h2><p>Approved RSS/API feeds will be collected, summarized, attributed and converted to broadcast-ready stories before the next scheduled programme.</p><div className="ticker">KENYA • AFRICA • WORLD • SPORTS • BUSINESS • ENTERTAINMENT</div></div><div className="buttons"><button onClick={()=>notify("News test started")}>▶ Test News</button><button onClick={()=>notify("News source setup opened")}>＋ Add News Source</button><button onClick={()=>notify("Voice settings opened")}>⚙ Voice Settings</button></div></div><div className="panel"><div className="title"><b>NEWS SOURCES</b></div>{["TUKO NEWS","STANDARD MEDIA","GDELT / GLOBAL","Custom RSS / API"].map(s=><div className="health" key={s}><span>{s}</span><b>Ready</b></div>)}</div></div>}

function Media({upload,files,selected,select,remove,fileInputRef,onFiles}:{upload:()=>void;files:{id:string;name:string;type:string;url:string;size:number}[];selected:string;select:(id:string)=>void;remove:(id:string)=>void;fileInputRef:React.RefObject<HTMLInputElement|null>;onFiles:(files:FileList|null)=>void}){return <div className="panel full"><div className="title"><b>MEDIA LIBRARY</b><button onClick={upload}>＋ Upload Media</button></div><input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={e=>{onFiles(e.target.files);e.currentTarget.value=""}}/><div className="media">{["🎬 Movies","📺 TV Shows","📢 Advertisements","🎵 Audio","🖼 Images","📁 Playlists"].map(x=><button key={x} onClick={upload}><b>{x}</b><small>{files.length} files</small></button>)}</div>{files.length===0?<div className="empty">No media yet. Upload videos, images or audio to test the Studio.</div>:<div className="libraryList">{files.map(f=><div className={"libraryItem "+(selected===f.id?"selected":"")} key={f.id} onClick={()=>select(f.id)}><div className="thumb">{f.type.startsWith("image/")?<img src={f.url} alt=""/>:f.type.startsWith("video/")?"🎬":"🎵"}</div><div><b>{f.name}</b><small>{f.type||"file"} • {(f.size/1024/1024).toFixed(1)} MB</small></div><button onClick={e=>{e.stopPropagation();remove(f.id)}}>Remove</button></div>)}</div>}<p className="muted">Browser playback is active for testing. Cloudinary storage and persistent media sync come next.</p></div>}

function Streaming({connected,toggle,live}:{connected:Record<string,boolean>;toggle:(x:string)=>void;live:boolean}){return <div className="two"><div className="panel"><div className="title"><b>STREAMING OUTPUTS</b></div>{Object.keys(connected).map(x=><div className="dest" key={x}><div><b>{x}</b><small>{connected[x]?"Connected":"Not connected"}</small></div><button onClick={()=>toggle(x)}>{connected[x]?"Disconnect":"Connect"}</button></div>)}<button className="big" onClick={()=>{if(!live){alert("Start GO LIVE first");return}if(!Object.values(connected).some(Boolean)){alert("Connect at least one destination first");return}alert("Multi-destination broadcast started")}}>GO LIVE TO ALL CONNECTED DESTINATIONS</button></div><div className="panel"><div className="title"><b>FAILSAFE</b></div><p>✓ Automatic reconnect</p><p>✓ Internet-loss detection</p><p>✓ Standby fallback</p><p>✓ Watchdog recovery</p></div></div>}

function Analytics({live}:{live:boolean}){return <div className="cards">{[["Live Viewers",live?"1":"0"],["Total Views",live?"1":"0"],["Watch Time",live?"00:01":"00:00"],["Followers","0"],["Peak Viewers",live?"1":"0"],["Health",live?"Stable":"Standby"]].map(x=><div className="metric" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>Today</span></div>)}</div>}

function Audience({notify}:{notify:(x:string)=>void}){return <div className="two"><div className="panel"><div className="title"><b>AUDIENCE & SHARING</b><button onClick={()=>notify("Metrics refreshed")}>↻ Refresh</button></div>{["Facebook Pages / Groups","YouTube Communities","TikTok Audience","Other Communities"].map(x=><div className="dest" key={x}><div><b>{x}</b><small>Official API permissions required</small></div><button onClick={()=>notify("Connection setup opened")}>Connect</button></div>)}</div><div className="panel"><div className="title"><b>SHARE MESSAGE</b></div><textarea defaultValue={"🔴 WE ARE LIVE!\n\nJoin us now for the latest programme.\n\nDigital Television Solution 📺"}/><button className="big" onClick={()=>notify("Share message prepared")}>Prepare Share</button></div></div>}

function Settings({notify}:{notify:(x:string)=>void}){return <div className="panel full"><div className="title"><b>SYSTEM SETTINGS</b></div><div className="settings"><button onClick={()=>notify("Broadcast engine settings opened")}>Broadcast Engine</button><button onClick={()=>notify("Cloudinary media settings opened")}>Cloud Media</button><button onClick={()=>notify("Platform authentication opened")}>Platform Accounts</button><button onClick={()=>notify("Failsafe settings opened")}>Failsafe & Recovery</button></div><p className="muted">The system is being rebuilt cleanly. Real streaming credentials, news APIs, Cloudinary storage and Android publishing will be connected in controlled stages.</p></div>}
