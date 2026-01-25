// mobile/utils/tts_loud.ts
import { Audio } from "expo-av";
import Constants from "expo-constants";

export type VoiceStyle = "calm" | "warning";

export type VoiceOptions = {
  slow?: boolean;
  voice?: string;        // alloy | nova | onyx
  style?: VoiceStyle;    // calm | warning
};

/**
 * 🔊 Senior-safe, backend-powered Tagalog TTS
 * Uses OpenAI voices (NOT iOS system voice)
 */
export async function speakLoud(
  text: string,
  options?: VoiceOptions
) {
  try {
    const voice = options?.voice ?? "alloy";
    const style = options?.style ?? "calm";

    // 🧠 Emotion prefix (helps model prosody)
    const styledText =
      style === "warning"
        ? `Babala. ${text}`
        : text;

    // 🔗 Backend URL (Render)
    const baseUrl =
      Constants.expoConfig?.extra?.API_BASE_URL ??
      "https://tara-ai-backend-swbp.onrender.com";

    const url =
      `${baseUrl}/tts` +
      `?text=${encodeURIComponent(styledText)}` +
      `&voice=${encodeURIComponent(voice)}`;

    // 🎧 Load & play audio
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      {
        shouldPlay: true,
        volume: 1.0,
        isLooping: false,
      }
    );

    // 🧹 Cleanup after playback
    sound.setOnPlaybackStatusUpdate((status) => {
      if ((status as any).didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (e) {
    console.warn("🔊 speakLoud (backend TTS) failed:", e);
  }
}
