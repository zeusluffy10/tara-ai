import * as Speech from "expo-speech";

export async function speakLoud(text: string) {
  try {
    Speech.stop();
    Speech.speak(text, {
      rate: 0.85,
      pitch: 1.0,
      language: "fil-PH",
    });
  } catch (e) {
    console.warn("speakLoud fallback failed", e);
  }
}