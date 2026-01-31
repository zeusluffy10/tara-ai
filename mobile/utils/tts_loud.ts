// mobile/utils/tts_loud.ts
import { Audio } from "expo-av";
import Constants from "expo-constants";

export type VoiceStyle = "calm" | "warning";
export type VoiceOptions = {
  voice?: string;
  style?: VoiceStyle;
  volume?: number;
  lang?: "fil" | "en";
};

let currentSound: Audio.Sound | null = null;
let lastStartAt = 0;

export async function stopSpeakLoud() {
  if (!currentSound) return;
  try {
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
  } catch {}
  currentSound = null;
}

export async function speakLoud(text: string, options?: VoiceOptions) {
  try {
    // ✅ always stop what’s currently playing first
    await stopSpeakLoud();

    const now = Date.now();
    // ✅ debounce only after stopping (prevents rapid re-trigger spam)
    if (now - lastStartAt < 250) return;
    lastStartAt = now;

    const voice = options?.voice ?? "alloy";
    const style = options?.style ?? "calm";
    const volume = options?.volume ?? 1.0;
    const lang = options?.lang ?? "fil";

    const baseUrl =
      Constants.expoConfig?.extra?.API_BASE_URL ??
      "https://tara-ai-backend-swbp.onrender.com";

    const url =
      `${baseUrl}/tts?` +
      `lang=${encodeURIComponent(lang)}&` +
      `voice=${encodeURIComponent(voice)}&` +
      `style=${encodeURIComponent(style)}&` +
      `text=${encodeURIComponent(text)}`;

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, volume }
    );

    currentSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      const s: any = status;

      if (!s?.isLoaded) {
        if (s?.error) console.warn("Audio playback error:", s.error);
        return;
      }

      if (s.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (currentSound === sound) currentSound = null;
      }
    });
  } catch (e) {
    console.warn("speakLoud failed:", e);
  }
}
