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
  } catch {}

  try {
    await currentSound.unloadAsync();
  } catch {}

  currentSound = null;
}

async function forcePlaybackMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

export async function speakLoud(text: string, options?: VoiceOptions) {
  try {
    await stopSpeakLoud();

    const now = Date.now();
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
      `lang=${encodeURIComponent(lang)}` +
      `&voice=${encodeURIComponent(voice)}` +
      `&style=${encodeURIComponent(style)}` +
      `&text=${encodeURIComponent(text)}`;

    // very important for iPhone loud playback after recording
    await forcePlaybackMode();

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      {
        shouldPlay: true,
        volume,
        progressUpdateIntervalMillis: 200,
      }
    );

    currentSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      const s: any = status;

      if (!s?.isLoaded) {
        if (s?.error) {
          console.warn("Audio playback error:", s.error);
        }
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