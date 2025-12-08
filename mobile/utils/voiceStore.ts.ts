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
