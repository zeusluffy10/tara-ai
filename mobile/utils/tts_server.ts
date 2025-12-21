// mobile/utils/tts_server.ts
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";

/**
 * Configure this to point to your FastAPI TTS endpoint (use your PC LAN IP).
 * Example: "http://192.168.110.210:8000/tts"
 */
const BACKEND_TTS_URL = "https://catalogs-figures-soil-conventions.trycloudflare.com/tts";

/** TS-safe: get a writable cache/document directory */
function getCacheDirectory(): string {
  const fsAny = FileSystem as any;
  const cacheDir = fsAny.cacheDirectory ?? fsAny.documentDirectory ?? "";
  if (!cacheDir) {
    throw new Error(
      "No writable directory available. Ensure expo-file-system is available at runtime."
    );
  }
  return cacheDir;
}

/** Convert ArrayBuffer -> base64 with btoa/Buffer fallback and small encoder fallback */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  try {
    // build binary string
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);

    // prefer global btoa
    if (typeof (global as any).btoa === "function") {
      return (global as any).btoa(binary);
    }

    // Buffer fallback (if polyfilled in App.tsx)
    if (typeof (global as any).Buffer === "function") {
      return (global as any).Buffer.from(binary, "binary").toString("base64");
    }

    // fallback encoder (slower but works)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    let i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      result +=
        chars[(n >>> 18) & 63] +
        chars[(n >>> 12) & 63] +
        chars[(n >>> 6) & 63] +
        chars[n & 63];
    }
    if (i < bytes.length) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8);
      result +=
        chars[(n >>> 18) & 63] +
        chars[(n >>> 12) & 63] +
        (typeof bytes[i + 1] !== "undefined" ? chars[(n >>> 6) & 63] : "=") +
        "=";
    }
    return result;
  } catch (e) {
    throw new Error("arrayBufferToBase64 failed: " + String(e));
  }
}

/** Safe encoding constant resolution for writeAsStringAsync */
function getEncodingBase64(): any {
  const fsAny = FileSystem as any;
  return (
    (fsAny.EncodingType && fsAny.EncodingType.Base64) ||
    (fsAny.Encoding && fsAny.Encoding.Base64) ||
    "base64"
  );
}

/**
 * Request server-side TTS, save MP3 to cache, and play with explicit volume.
 * Returns the created Audio.Sound instance so caller can unload if desired.
 *
 * @param text Text to synthesize
 * @param voice Optional server voice id (depends on your backend)
 * @param volume 0.0 - 1.0
 */
export async function playServerTTS(
  text: string,
  voice?: string,
  volume = 1.0
) {
  if (!BACKEND_TTS_URL || BACKEND_TTS_URL.includes("YOUR_COMPUTER_IP")) {
    throw new Error(
      "BACKEND_TTS_URL not configured in mobile/utils/tts_server.ts. Replace with your backend URL."
    );
  }

  // POST request
  const resp = await fetch(BACKEND_TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`TTS server error ${resp.status}: ${body}`);
  }

  // get audio bytes
  const arr = await resp.arrayBuffer();
  const base64 = arrayBufferToBase64(arr);

  // write file to cache
  const cacheDir = getCacheDirectory();
  const path = `${cacheDir}server_tts.mp3`;

  const encoding = getEncodingBase64();
  await (FileSystem as any).writeAsStringAsync(path, base64, { encoding } as any);

  // create & play with explicit volume
  const { sound } = await Audio.Sound.createAsync(
    { uri: path },
    { shouldPlay: true, volume }
  );

  // auto-unload after finish
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      setTimeout(() => sound.unloadAsync().catch(() => {}), 300);
    }
  });

  return sound;
}
