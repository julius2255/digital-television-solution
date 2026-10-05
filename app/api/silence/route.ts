import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // 1 second of silent 48 kHz mono PCM audio. Keeping a real, silent audio
  // track in the Program Output gives RTMP/Facebook an audio stream even when
  // the selected Program source is an image or a silent graphic.
  const sampleRate = 48000;
  const samples = sampleRate;
  const dataSize = samples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
