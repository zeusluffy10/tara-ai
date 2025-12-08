// mobile/utils/tts.ts
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { loadPreferredVoiceId } from "./voiceStore.ts";
import { playServerTTS } from "./tts_server";

/**
 * speakWithBestVoice
 * - text: text to speak
 * - slow: whether to slow voice slightly
 * - pitch: expo-speech pitch (1.0 normal)
 * - options:
 *    - forceServer: boolean -> always use server MP3 playback (loud)
 *    - serverVoiceId: pass-through voice id for server (optional)
 *    - volume: when using server playback, volume 0.0-1.0
 */
export async function speakWithBestVoice(
  text: string,
  slow = false,
  pitch = 1.05,
  options?: {
    forceServer?: boolean;
    serverVoiceId?: string;
    volume?: number;
  }
): Promise<void | any> {
  const { forceServer = false, serverVoiceId, volume = 1.0 } = options || {};

  // best-effort: ensure background/silent playback on iOS
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
    });
  } catch (e) {
    // ignore
  }

  // If caller forces server TTS, do it directly
  if (forceServer) {
    try {
      return await playServerTTS(text, serverVoiceId, volume);
    } catch (err) {
      console.warn("speakWithBestVoice: server TTS failed", err);
      // fallback to device if server fails
    }
  }

  // Try on-device TTS
  try {
    // stop any ongoing speech
    try {
      await (Speech as any).stop?.();
    } catch {}

    const preferredVoice = await loadPreferredVoiceId(); // may be null

    const baseOpts: any = { rate: slow ? 0.85 : 1.0, pitch };

    // If preferred voice is set, try to use it
    if (preferredVoice) {
      try {
        // Some platforms accept voice id directly
        Speech.speak(text, { ...baseOpts, voice: preferredVoice });
        return;
      } catch (e) {
        console.warn("speakWithBestVoice: preferred voice speak failed", e);
        // fallback to generic speak below
      }
    }

    // Generic on-device speak
    try {
      Speech.speak(text, baseOpts);
      return;
    } catch (e) {
      console.warn("speakWithBestVoice: on-device speak failed", e);
    }
  } catch (err) {
    console.warn("speakWithBestVoice: unexpected error", err);
  }

  // If on-device failed or was too quiet, use server fallback
  try {
    return await playServerTTS(text, serverVoiceId, volume);
  } catch (err) {
    console.error("speakWithBestVoice: server fallback also failed", err);
    // nothing left to do
  }
}
