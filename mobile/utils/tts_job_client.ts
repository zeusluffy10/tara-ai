// mobile/utils/tts_job_client.ts
import { playServerTTS } from "./tts_server"; // we'll reuse its download+play if you want
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";

const BASE = "https://lying-liable-wales-led.trycloudflare.com"; // replace with your public/tunnel or LAN base

export async function startTtsJob(text: string, voice?: string) {
  const resp = await fetch(`${BASE}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  if (!resp.ok) {
    throw new Error(`startTtsJob failed: ${resp.status} ${await resp.text()}`);
  }
  return resp.json(); // { job_id, status }
}

export async function getTtsStatus(jobId: string) {
  const resp = await fetch(`${BASE}/tts/status/${jobId}`);
  if (!resp.ok) throw new Error(`status call failed ${resp.status}`);
  return resp.json();
}

/**
 * Poll until done (simple linear polling).
 * - pollIntervalMs defaults to 1500ms; tune as desired.
 */
export async function waitForTts(jobId: string, pollIntervalMs = 1500, timeoutMs = 60000) {
  const start = Date.now();
  while (true) {
    const status = await getTtsStatus(jobId);
    if (status.status === "done") return status;
    if (status.status === "error") throw new Error(status.error || "tts job error");
    if (Date.now() - start > timeoutMs) throw new Error("tts job timeout");
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

/** Download result and play using expo-av (or call your tts_server helper) */
export async function downloadAndPlay(jobId: string) {
  const url = `${BASE}/tts/result/${jobId}`;
  // reuse code similar to tts_server: fetch arrayBuffer, save to cache, play
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const arr = await res.arrayBuffer();
  // convert to base64 then write to cache (or use blob-to-file technique)
  // Use the same logic as tts_server.arrayBufferToBase64; for brevity reuse the polyfill btoa/Buffer
  let binary = "";
  const bytes = new Uint8Array(arr);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = (global as any).btoa ? (global as any).btoa(binary) : (global as any).Buffer.from(binary, "binary").toString("base64");
  const fsAny = FileSystem as any;
  const cacheDir = fsAny.cacheDirectory ?? fsAny.documentDirectory ?? "";
  const path = `${cacheDir}job_${jobId}.mp3`;
  await (FileSystem as any).writeAsStringAsync(path, base64, { encoding: "base64" });
  const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true, volume: 1.0 });
  sound.setOnPlaybackStatusUpdate((s) => {
    if (s.isLoaded && s.didJustFinish) {
      sound.unloadAsync().catch(() => {});
    }
  });
  return sound;
}
