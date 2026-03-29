// mobile/utils/voiceStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_OPENAI_VOICE = "tara_openai_tts_voice";
const KEY_TTS_GENDER = "tara_openai_tts_gender";
const KEY_TTS_PAUSE_MS = "tara_openai_tts_pause_ms";
const KEY_TTS_EMPHASIS = "tara_openai_tts_emphasis";
const KEY_SENIOR_SLOW = "tara_senior_slow_voice";

export type TtsGender = "female" | "male";
export type TtsEmphasis = "low" | "medium" | "high";

export function getDefaultVoiceForGender(gender: TtsGender): string {
  return gender === "male" ? "onyx" : "nova";
}

// ✅ OpenAI voice (used by backend /tts)
export async function saveTtsVoice(voice: string) {
  await AsyncStorage.setItem(KEY_OPENAI_VOICE, voice);
}

export async function loadTtsVoice(): Promise<string | null> {
  return await AsyncStorage.getItem(KEY_OPENAI_VOICE);
}

export async function saveTtsGender(gender: TtsGender) {
  await AsyncStorage.setItem(KEY_TTS_GENDER, gender);
}

export async function loadTtsGender(): Promise<TtsGender> {
  const saved = await AsyncStorage.getItem(KEY_TTS_GENDER);
  return saved === "male" ? "male" : "female";
}

export async function saveTtsPauseMs(pauseMs: number) {
  await AsyncStorage.setItem(KEY_TTS_PAUSE_MS, String(Math.max(80, Math.min(650, Math.round(pauseMs)))));
}

export async function loadTtsPauseMs(): Promise<number> {
  const saved = await AsyncStorage.getItem(KEY_TTS_PAUSE_MS);
  const parsed = saved ? Number(saved) : NaN;
  return Number.isFinite(parsed) ? Math.max(80, Math.min(650, Math.round(parsed))) : 280;
}

export async function saveTtsEmphasis(emphasis: TtsEmphasis) {
  await AsyncStorage.setItem(KEY_TTS_EMPHASIS, emphasis);
}

export async function loadTtsEmphasis(): Promise<TtsEmphasis> {
  const saved = await AsyncStorage.getItem(KEY_TTS_EMPHASIS);
  if (saved === "low" || saved === "high") return saved;
  return "medium";
}

// ✅ Keep your existing slow toggle (if not already)
export async function saveSeniorSlowVoice(v: boolean) {
  await AsyncStorage.setItem(KEY_SENIOR_SLOW, v ? "1" : "0");
}

export async function loadSeniorSlowVoice(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY_SENIOR_SLOW);
  return v === null ? true : v === "1";
}
