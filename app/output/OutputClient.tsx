"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

type OutputLayer = {
  id: string;
  name: string;
  kind: "video" | "image" | "text";
  mediaId?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zoom: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
  visible: boolean;
  locked: boolean;
  role?: "channel-logo" | "show-logo";
  media?: { url: string; name: string; type: string } | null;
};

type NewsItem = {
  title?: string;
  description?: string;
  image?: string;
  source?: string;
  category?: string;
  published?: string;
};

type ProgramState = {
  type: "chemchem-program-state";
  version: number;
  source: string;
  playing: boolean;
  position: number;
  webUrl: string;
  media: { url: string; name: string; type: string } | null;
  layers: OutputLayer[];
  newsOnAir: NewsItem | null;
  volume: number;
  muted: boolean;
  transition: "cut" | "fade";
  fadeMs: number;
  sentAt: number;
};

const TOPIC = "chemchem-program";

function isVideo(media?: { type?: string } | null) {
  return !!media && /^video\//i.test(media.type || "");
}

function isImage(media?: { type?: string; url?: string } | null) {
  if (!media) return false;
  return /^image\//i.test(media.type || "") || /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(media.url || "");
}

function mediaFitStyle(layer: OutputLayer) {
  return {
    position: "absolute" as const,
    width: (100 + layer.cropLeft + layer.cropRight) * layer.zoom + "%",
    height: (100 + layer.cropTop + layer.cropBottom) * layer.zoom + "%",
    left: -layer.cropLeft * layer.zoom + "%",
    top: -layer.cropTop * layer.zoom + "%"
  };
}

function boxStyle(layer: OutputLayer) {
  return {
    position: "absolute" as const,
    left: layer.x + "%",
    top: layer.y + "%",
    width: layer.width + "%",
    height: layer.height + "%",
    opacity: layer.opacity,
    transform: "rotate(" + layer.rotation + "deg)",
    overflow: "hidden" as const
  };
}

export default function OutputClient({ name }: { name: string }) {
  const [state, setState] = useState<ProgramState | null>(null);
  const [status, setStatus] = useState("CONNECTING");
  const [remoteCamera, setRemoteCamera] = useState<MediaStreamTrack | null>(null);
  const [remoteScreen, setRemoteScreen] = useState<MediaStreamTrack | null>(null);
  const [remoteAudio, setRemoteAudio] = useState<MediaStreamTrack | null>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const silenceRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  const renderedMediaKeyRef = useRef("");
  const stateRef = useRef<ProgramState | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    const decoder = new TextDecoder();

    const connect = async () => {
      try {
        const response = await fetch("/api/livekit/token?role=viewer", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Live output token could not be created.");

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (value) => {
          if (!cancelled) setStatus(String(value).toUpperCase());
        });

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (!participant.identity.startsWith("chemchem-director-")) return;
          if (track.kind === Track.Kind.Video) {
            if (publication.source === Track.Source.Camera) setRemoteCamera(track.mediaStreamTrack);
            if (publication.source === Track.Source.ScreenShare) setRemoteScreen(track.mediaStreamTrack);
          }
          if (track.kind === Track.Kind.Audio) {
            if (publication.source === Track.Source.Microphone || publication.source === Track.Source.ScreenShareAudio) {
              setRemoteAudio(track.mediaStreamTrack);
            }
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          if (!participant.identity.startsWith("chemchem-director-")) return;
          if (track.kind === Track.Kind.Video && publication.source === Track.Source.Camera) {
            setRemoteCamera((v) => v === track.mediaStreamTrack ? null : v);
          }
          if (track.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
            setRemoteScreen((v) => v === track.mediaStreamTrack ? null : v);
          }
          if (track.kind === Track.Kind.Audio && (publication.source === Track.Source.Microphone || publication.source === Track.Source.ScreenShareAudio)) {
            setRemoteAudio((v) => v === track.mediaStreamTrack ? null : v);
          }
        });

        room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
          if (topic !== TOPIC) return;
          try {
            const message = JSON.parse(decoder.decode(payload));
            if (message?.type === "chemchem-program-state") setState(message as ProgramState);
          } catch {}
        });

        await room.connect(data.url, data.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setStatus("CONNECTED");
        await room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ type: "chemchem-program-request" })),
          { reliable: true, topic: TOPIC }
        );
      } catch (error: any) {
        if (!cancelled) setStatus("ERROR: " + (error?.message || "Live output connection failed."));
      }
    };

    void connect();
    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.srcObject = remoteCamera ? new MediaStream([remoteCamera]) : null;
    if (remoteCamera) cameraRef.current.play().catch(() => {});
  }, [remoteCamera]);

  useEffect(() => {
    if (!screenRef.current) return;
    screenRef.current.srcObject = remoteScreen ? new MediaStream([remoteScreen]) : null;
    if (remoteScreen) screenRef.current.play().catch(() => {});
  }, [remoteScreen]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = remoteAudio ? new MediaStream([remoteAudio]) : null;
    audioRef.current.volume = state?.volume ?? 1;
    audioRef.current.muted = !!state?.muted || (state?.source !== "camera" && state?.source !== "screen");
    if (remoteAudio) audioRef.current.play().catch(() => {});
  }, [remoteAudio, state?.volume, state?.muted, state?.source]);

  useEffect(() => {
    // A real silent audio track keeps image/graphic programs valid for RTMP
    // while never replacing the active Program audio source.
    const audio = silenceRef.current;
    if (!audio) return;
    audio.volume = 1;
    audio.muted = false;
    audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    // Keep a real silent audio track in the browser output for image/graphic
    // programs. This prevents a still-image program from becoming a video-only
    // RTMP stream. It is deliberately silent and does not replace Program audio.
    const audio = silenceRef.current;
    if (!audio) return;
    audio.volume = 1;
    audio.muted = false;
    audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    const video = document.getElementById("chemchem-output-base-video") as HTMLVideoElement | null;
    if (!video || !state || !isVideo(state.media)) return;

    video.volume = state.muted ? 0 : Math.max(0, Math.min(1, state.volume));
    video.muted = !!state.muted;

    const key = (state.media?.url || "") + "|" + (state.playing ? "1" : "0");
    if (renderedMediaKeyRef.current !== key) {
      renderedMediaKeyRef.current = key;
      const target = Math.max(0, state.position || 0);
      if (Math.abs(video.currentTime - target) > 1.5) video.currentTime = target;
    } else if (state.playing) {
      const target = Math.max(0, state.position || 0);
      if (Math.abs(video.currentTime - target) > 2.5) video.currentTime = target;
    }

    if (state.playing) video.play().catch(() => {});
    else video.pause();
  }, [state]);

  const renderBaseMedia = () => {
    const media = state?.media;
    if (!media) return null;

    if (isImage(media)) {
      return <img src={media.url} alt={media.name} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />;
    }

    if (isVideo(media)) {
      return (
        <video
          id="chemchem-output-base-video"
          src={media.url}
          autoPlay
          loop
          playsInline
          muted={!!state?.muted}
          controls={false}
          preload="auto"
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
          onLoadedMetadata={(event) => {
            if (!state) return;
            event.currentTarget.currentTime = Math.max(0, state.position || 0);
            event.currentTarget.volume = state.muted ? 0 : Math.max(0, Math.min(1, state.volume));
            if (state.playing) event.currentTarget.play().catch(() => {});
          }}
        />
      );
    }

    return null;
  };

  const renderLayer = (layer: OutputLayer, index: number) => {
    if (!layer.visible || !layer.media && layer.kind !== "text") return null;
    const box = boxStyle(layer);

    if (layer.kind === "text") {
      return (
        <div
          key={layer.id + "-" + index}
          style={{
            ...box,
            display: "grid",
            placeItems: "center",
            padding: 8,
            color: "#fff",
            fontWeight: 900,
            fontSize: "clamp(10px,2vw,34px)",
            textAlign: "center",
            background: "rgba(0,0,0,.18)",
            textShadow: "0 2px 8px rgba(0,0,0,.9)",
            zIndex: 50 + index
          }}
        >
          {layer.text || "TEXT"}
        </div>
      );
    }

    if (!layer.media) return null;
    const fit = mediaFitStyle(layer);

    return (
      <div key={layer.id + "-" + index} style={{ ...box, zIndex: 30 + index }}>
        {layer.kind === "image" ? (
          <img src={layer.media.url} alt={layer.media.name} style={fit} />
        ) : (
          <video src={layer.media.url} autoPlay loop muted playsInline style={{ ...fit, background: "#000" }} />
        )}
      </div>
    );
  };

  const news = state?.newsOnAir;
  const cameraActive = state?.source === "camera";
  const screenActive = state?.source === "screen";
  const newsActive = state?.source === "news" && !!news;

  return (
    <main style={{ margin: 0, width: "100vw", height: "100vh", overflow: "hidden", background: "#000", color: "#fff", fontFamily: "Arial,sans-serif", position: "relative" }}>
      <style>{"@keyframes chemchemOutputFade{from{opacity:0}to{opacity:1}}"}</style>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          animation: state?.transition === "fade" ? "chemchemOutputFade " + Math.max(200, state.fadeMs || 800) + "ms ease-in-out both" : undefined
        }}
      >
        {cameraActive && <video ref={cameraRef} autoPlay playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {screenActive && <video ref={screenRef} autoPlay playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}

        {state?.webUrl && !cameraActive && !screenActive && (
          <iframe src={state.webUrl} title={name} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        )}

        {newsActive && (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#061329", color: "#fff" }}>
            {news?.image && <img src={news.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.42 }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(3,12,25,.98),rgba(3,12,25,.74) 60%,rgba(3,12,25,.25))" }} />
            <div style={{ position: "absolute", left: "4%", right: "4%", top: "7%" }}>
              <b style={{ fontSize: "clamp(18px,3vw,42px)", letterSpacing: 1 }}>CHEMCHEM <span style={{ background: "#e5232f", padding: "4px 7px" }}>TV KENYA</span></b>
              <div style={{ marginTop: 6, color: "#9fdcff", fontSize: "clamp(9px,1vw,14px)", fontWeight: 800 }}>
                LIVE NEWSROOM • {String(news?.category || "KENYA").toUpperCase()} • COURTESY OF {String(news?.source || "NEWSROOM").toUpperCase()}
              </div>
            </div>
            <div style={{ position: "absolute", left: "4%", right: "6%", top: "30%" }}>
              <div style={{ color: "#ff6370", fontWeight: 900, fontSize: "clamp(10px,1.1vw,16px)" }}>● LIVE NEWS</div>
              <h1 style={{ fontSize: "clamp(24px,4.3vw,68px)", lineHeight: 1.04, margin: "12px 0 18px", maxWidth: "92%" }}>{news?.title || "CHEMCHEM TV KENYA NEWS"}</h1>
              <p style={{ fontSize: "clamp(12px,1.5vw,24px)", lineHeight: 1.35, maxWidth: "78%", color: "rgba(255,255,255,.88)", margin: 0 }}>{news?.description || ""}</p>
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 4%", background: "rgba(229,35,47,.95)", fontWeight: 900 }}>
              {news?.title || "LIVE NEWS"} • COURTESY OF {news?.source || "NEWSROOM"}
            </div>
          </div>
        )}

        {!cameraActive && !screenActive && !state?.webUrl && !newsActive && state?.media && (
          <div style={{ position: "absolute", inset: 0 }}>{renderBaseMedia()}</div>
        )}

        {!cameraActive && !screenActive && !state?.webUrl && !newsActive && !state?.media && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", background: "radial-gradient(circle at center,#173257 0,#050b14 62%,#000 100%)" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: "clamp(28px,4vw,60px)", letterSpacing: 2 }}>CHEMCHEM TV KENYA</div>
              <div style={{ marginTop: 12, color: "#a9b9cb", fontSize: "clamp(14px,1.6vw,24px)" }}>PROGRAM / LIVE OUTPUT</div>
              <div style={{ marginTop: 10, color: "#45d789", fontWeight: 800 }}>{status}</div>
            </div>
          </div>
        )}

        {state?.layers?.map(renderLayer)}

        <div style={{ position: "absolute", left: 14, bottom: 12, zIndex: 100, padding: "6px 10px", borderRadius: 5, background: "rgba(0,0,0,.68)", fontSize: 11, fontWeight: 900 }}>
          CHEMCHEM TV KENYA • LIVE OUTPUT
        </div>
      </div>

      <audio ref={audioRef} autoPlay playsInline />
      <audio ref={silenceRef} src="/api/silence" autoPlay loop playsInline preload="auto" aria-hidden="true" />
    </main>
  );
}
