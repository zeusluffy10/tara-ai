// mobile/utils/tts_loud.ts

import * as Speech from "expo-speech";

/**
 * Polished Filipino navigation voice
 * Uses English neural voice for clarity
 */
export async function speakLoud(text: string) {
  try {
    Speech.stop();

    Speech.speak(text, {
      language: "en-US", // IMPORTANT: do NOT use fil-PH
      rate: 0.80,        // slower = clearer
      pitch: 0.95,       // calm, authoritative
      volume: 1.0,
    });
  } catch (e) {
    console.warn("speakLoud failed", e);
  }
}
