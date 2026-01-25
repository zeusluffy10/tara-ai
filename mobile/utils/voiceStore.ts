// mobile/utils/voiceStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_OPENAI_VOICE = "tara_openai_tts_voice";
const KEY_SENIOR_SLOW = "tara_senior_slow_voice";

// ✅ OpenAI voice (used by backend /tts)
export async function saveTtsVoice(voice: string) {
  await AsyncStorage.setItem(KEY_OPENAI_VOICE, voice);
}

export async function loadTtsVoice(): Promise<string | null> {
  return await AsyncStorage.getItem(KEY_OPENAI_VOICE);
}

// ✅ Keep your existing slow toggle (if not already)
export async function saveSeniorSlowVoice(v: boolean) {
  await AsyncStorage.setItem(KEY_SENIOR_SLOW, v ? "1" : "0");
}

export async function loadSeniorSlowVoice(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY_SENIOR_SLOW);
  return v === null ? true : v === "1";
}
