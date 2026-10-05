import React from "react";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function youtubeEmbed(src: string) {
  try {
    const u = new URL(src);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      return id ? "https://www.youtube.com/embed/" + id + "?autoplay=1&mute=0&playsinline=1" : src;
    }
    if (u.hostname === "youtu.be") {
      return "https://www.youtube.com/embed" + u.pathname + "?autoplay=1&mute=0&playsinline=1";
    }
  } catch {}
  return src;
}

export default async function ProgramOutput({ searchParams }: Props) {
  const q = await searchParams;
  const src = one(q.src);
  const name = one(q.name) || "CHEMCHEM TV KENYA — PROGRAM";
  const kind = one(q.kind);

  const isImage = /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(src);
  const isVideo = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(src);
  const isYoutube = /youtube\.com|youtu\.be/i.test(src);

  return (
    <main style={{margin:0,width:"100vw",height:"100vh",overflow:"hidden",background:"#000",color:"#fff",fontFamily:"Arial,sans-serif",position:"relative"}}>
      {isVideo ? (
        <video src={src} autoPlay loop playsInline style={{width:"100%",height:"100%",objectFit:"contain",background:"#000"}} />
      ) : isImage ? (
        <img src={src} alt={name} style={{width:"100%",height:"100%",objectFit:"contain",background:"#000"}} />
      ) : isYoutube ? (
        <iframe src={youtubeEmbed(src)} title={name} allow="autoplay; encrypted-media; picture-in-picture" style={{border:0,width:"100%",height:"100%"}} />
      ) : (
        <div style={{width:"100%",height:"100%",display:"grid",placeItems:"center",background:"radial-gradient(circle at center,#18283d 0,#050a12 60%,#000 100%)",textAlign:"center"}}>
          <div>
            <div style={{fontSize:42,fontWeight:800,letterSpacing:2}}>CHEMCHEM TV KENYA</div>
            <div style={{fontSize:25,marginTop:18,color:"#d4dbe5"}}>● PROGRAM OUTPUT</div>
            <div style={{fontSize:19,marginTop:12,color:"#8fa0b5"}}>{name}</div>
            <div style={{fontSize:14,marginTop:28,color:"#35d17c"}}>{kind ? kind.toUpperCase() : "LIVE PROGRAM"} • 24/7</div>
          </div>
        </div>
      )}
      <div style={{position:"absolute",left:18,bottom:14,padding:"7px 12px",borderRadius:6,background:"rgba(0,0,0,.62)",fontSize:12,fontWeight:700}}>CHEMCHEM TV KENYA • LIVE PROGRAM</div>
    </main>
  );
}
