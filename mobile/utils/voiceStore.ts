// mobile/utils/voiceStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "TARA_SELECTED_VOICE";

export async function savePreferredVoiceId(id: string | null) {
  if (!id) await AsyncStorage.removeItem(KEY);
  else await AsyncStorage.setItem(KEY, id);
}

export async function loadPreferredVoiceId(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(KEY)) || null;
  } catch (e) {
    console.warn("voiceStore load error", e);
    return null;
  }
}

// ===========================
// Senior ultra-slow voice (NEW)
// ===========================
const SLOW_VOICE_KEY = "TARA_SENIOR_SLOW_VOICE";

export async function saveSeniorSlowVoice(v: boolean) {
  try {
    await AsyncStorage.setItem(SLOW_VOICE_KEY, JSON.stringify(v));
  } catch (e) {
    console.warn("voiceStore saveSeniorSlowVoice error", e);
  }
}

export async function loadSeniorSlowVoice(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(SLOW_VOICE_KEY);
    return v ? JSON.parse(v) : true; // ✅ default ON for seniors
  } catch (e) {
    console.warn("voiceStore loadSeniorSlowVoice error", e);
    return true;
  }
}
