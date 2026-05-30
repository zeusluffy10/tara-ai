// mobile/utils/tts_loud.ts
import { AudioModule, useAudioPlayer } from "expo-audio";
import { createAudioPlayer } from "expo-audio";
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

let currentPlayer: ReturnType<typeof createAudioPlayer> | null = null;
let lastStartAt = 0;
let playbackModeReady = false;
let lastRequestSignature = "";
let lastRequestAt = 0;
let activeSpeakToken = 0;
const isDev = Boolean((globalThis as any).__DEV__);
let inFlightSpeakCount = 0;

export function getTtsDebugState() {
  return {
    inFlightSpeakCount,
    hasCurrentPlayer: Boolean(currentPlayer),
    activeSpeakToken,
    lastStartAt,
    lastRequestAt,
  };
}

export async function stopSpeakLoud(invalidatePending = true) {
  if (invalidatePending) {
    activeSpeakToken += 1;
  }

  if (!currentPlayer) return;

  try {
    currentPlayer.pause();
  } catch {}

  try {
    currentPlayer.remove();
  } catch {}

  currentPlayer = null;
}

async function forcePlaybackMode() {
  if (playbackModeReady) return;

  await AudioModule.setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });

  playbackModeReady = true;
}

export async function speakLoud(text: string, options?: VoiceOptions) {
  inFlightSpeakCount += 1;

  try {
    const cleanedText = (text || "").trim();
    if (!cleanedText) return;

    const now = Date.now();
    const signature = [
      cleanedText,
      options?.voice ?? "",
      options?.gender ?? "female",
      options?.style ?? "calm",
      options?.emphasis ?? "medium",
      String(options?.pauseMs ?? 280),
      options?.lang ?? "fil",
    ].join("|");

    if (signature === lastRequestSignature && now - lastRequestAt < 1800) {
      if (isDev) {
        console.debug("[tts_loud] duplicate request ignored", {
          elapsedMs: now - lastRequestAt,
          preview: cleanedText.slice(0, 64),
        });
      }
      return;
    }

    if (now - lastStartAt < 250) {
      if (isDev) {
        console.debug("[tts_loud] throttled request ignored", {
          elapsedMs: now - lastStartAt,
          preview: cleanedText.slice(0, 64),
        });
      }
      return;
    }

    lastRequestSignature = signature;
    lastRequestAt = now;

    const requestToken = ++activeSpeakToken;

    await stopSpeakLoud(false);

    if (requestToken !== activeSpeakToken) return;

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

    if (isDev) {
      console.debug("[tts_loud] playback start", {
        preview: cleanedText.slice(0, 64),
      });
    }

    await forcePlaybackMode();

    if (requestToken !== activeSpeakToken) return;

    const player = createAudioPlayer({ uri: url });
    player.volume = volume;

    if (requestToken !== activeSpeakToken) {
      player.remove();
      return;
    }

    currentPlayer = player;
    player.play();

    // Listen for playback finish
    const subscription = player.addListener("playbackStatusUpdate", (status: any) => {
      if (requestToken !== activeSpeakToken) {
        subscription.remove();
        return;
      }
      if (status.didJustFinish) {
        subscription.remove();
        player.remove();
        if (currentPlayer === player) currentPlayer = null;
      }
      if (status.error) {
        console.warn("Audio playback error:", status.error);
        subscription.remove();
      }
    });

  } catch (e) {
    console.warn("speakLoud failed:", e);
  } finally {
    inFlightSpeakCount = Math.max(0, inFlightSpeakCount - 1);
  }
}
