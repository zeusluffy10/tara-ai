// mobile/utils/tts_loud.ts
import * as Speech from "expo-speech";

/**
 * Global voice settings
 * Senior-friendly by default
 */
export type VoiceOptions = {
  slow?: boolean;
};

export async function speakLoud(
  text: string,
  options?: VoiceOptions
) {
  try {
    Speech.stop();

    const isSlow = options?.slow ?? false;

    Speech.speak(text, {
      language: "en-US", // clearer than fil-PH
      rate: isSlow ? 0.65 : 0.80,  // 🧓 ultra-slow vs normal
      pitch: 0.95,
      volume: 1.0,
    });
  } catch (e) {
    console.warn("speakLoud failed", e);
  }
}
