// mobile/utils/tts_loud.ts
import { Audio } from "expo-av";
import Constants from "expo-constants";

import { TtsEmphasis, TtsGender } from "./voiceStore";

export type VoiceStyle = "calm" | "warning";
export type VoiceOptions = {
  voice?: string;
  gender?: TtsGender;
  style?: VoiceStyle;
  emphasis?: TtsEmphasis;
  pauseMs?: number;
  volume?: number;
  lang?: "fil" | "en";
};

let currentSound: Audio.Sound | null = null;
let lastStartAt = 0;
let playbackModeReady = false;

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
  if (playbackModeReady) return;

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });

  playbackModeReady = true;
}

export async function speakLoud(text: string, options?: VoiceOptions) {
  try {
    const cleanedText = (text || "").trim();
    if (!cleanedText) return;

    await stopSpeakLoud();

    const now = Date.now();
    if (now - lastStartAt < 250) return;
    lastStartAt = now;

    const voice = options?.voice;
    const gender = options?.gender ?? "female";
    const style = options?.style ?? "calm";
    const emphasis = options?.emphasis ?? "medium";
    const pauseMs = options?.pauseMs ?? 280;
    const volume = options?.volume ?? 1.0;
    const lang = options?.lang ?? "fil";

    const baseUrl =
      Constants.expoConfig?.extra?.API_BASE_URL ??
      "https://tara-ai-backend-swbp.onrender.com";

    const params = new URLSearchParams({
      lang,
      gender,
      style,
      emphasis,
      pause_ms: String(Math.max(80, Math.min(650, Math.round(pauseMs)))),
      text: cleanedText,
    });

    if (voice) {
      params.set("voice", voice);
    }

    const url = `${baseUrl}/tts?${params.toString()}`;

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