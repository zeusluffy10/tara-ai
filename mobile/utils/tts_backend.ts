export {};

// // mobile/utils/tts_backend.ts
// import { Audio } from "expo-av";

// export type TtsStyle = "calm" | "warning";

// export type BackendTtsOptions = {
//   lang?: "fil" | "en";
//   voice?: string;         // "nova" (female) / "alloy" (male) / etc
//   style?: TtsStyle;       // "calm" | "warning"
//   volume?: number;        // 0..1
// };

// let sound: Audio.Sound | null = null;

// // ✅ Put your Render base URL here (same as you use now)
// const BASE_URL = "https://tara-ai-backend-swbp.onrender.com";

// export async function stopTts() {
//   if (!sound) return;
//   try {
//     await sound.stopAsync();
//   } catch {}
//   try {
//     await sound.unloadAsync();
//   } catch {}
//   sound = null;
// }

// export async function speakBackendTts(text: string, opts: BackendTtsOptions = {}) {
//   const finalText = (text || "").trim();
//   if (!finalText) return;

//   // stop previous so Next feels instant
//   await stopTts();

//   // make sure audio plays loud
//   await Audio.setAudioModeAsync({
//     playsInSilentModeIOS: true,
//     allowsRecordingIOS: false,
//     staysActiveInBackground: false,
//     shouldDuckAndroid: false,
//   });

//   const lang = opts.lang ?? "fil";
//   const voice = opts.voice ?? "nova";      // ✅ default female
//   const style = opts.style ?? "calm";
//   const volume = opts.volume ?? 1.0;

//   // GET /tts?text=...&lang=fil&voice=nova&style=calm
//   const url =
//     `${BASE_URL}/tts` +
//     `?lang=${encodeURIComponent(lang)}` +
//     `&voice=${encodeURIComponent(voice)}` +
//     `&style=${encodeURIComponent(style)}` +
//     `&text=${encodeURIComponent(finalText)}`;

//   const result = await Audio.Sound.createAsync(
//     { uri: url },
//     {
//       shouldPlay: true,
//       volume,
//     }
//   );

//   sound = result.sound;

//   // cleanup when finished
//   sound.setOnPlaybackStatusUpdate((status: any) => {
//     if (status?.didJustFinish) {
//       stopTts().catch(() => {});
//     }
//   });
// }
