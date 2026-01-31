// // mobile/utils/tts_server.ts
// // ✅ No expo-av here. No file system. No extra audio engine.
// import Constants from "expo-constants";
// import { playAudioUri } from "./tts_loud";

// type Style = "calm" | "warning";

// const DEFAULT_BASE =
//   (Constants.expoConfig as any)?.extra?.API_BASE_URL ??
//   "https://tara-ai-backend-swbp.onrender.com";

// /**
//  * ✅ Play server-side TTS using the single shared player.
//  * - Uses GET /tts streaming (best for Safari + Expo playback)
//  * - Avoids saving mp3 to filesystem (less bugs, faster)
//  */
// export async function playServerTTS(
//   text: string,
//   opts?: {
//     voice?: string;
//     style?: Style;
//     lang?: string; // "fil" default
//   }
// ) {
//   const voice = opts?.voice ?? "alloy";
//   const style: Style = opts?.style ?? "calm";
//   const lang = opts?.lang ?? "fil";

//   const url =
//     `${DEFAULT_BASE}/tts` +
//     `?text=${encodeURIComponent(text)}` +
//     `&voice=${encodeURIComponent(voice)}` +
//     `&style=${encodeURIComponent(style)}` +
//     `&lang=${encodeURIComponent(lang)}`;

//   // ✅ uses your single shared Audio.Sound instance from tts_loud.ts
//   return await playAudioUri(url);
// }
