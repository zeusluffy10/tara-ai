// mobile/utils/tts.ts
import * as Speech from "expo-speech";
import { Audio } from "expo-av";

async function getAvailableVoicesSafe(): Promise<any[]> {
  try {
    return (await (Speech as any).getAvailableVoicesAsync?.()) || [];
  } catch (e) {
    console.warn("TTS: getAvailableVoicesAsync failed", e);
    return [];
  }
}

export async function speakWithBestVoice(textToSpeak: string, slow = false) {
  try {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
      });
    } catch (e) {
      console.warn("TTS: setAudioModeAsync failed", e);
    }

    try { await (Speech as any).stop?.(); } catch (e) {}

    const voices = await getAvailableVoicesSafe();
    const prefer = voices.find((v: any) => (v.language || "").startsWith("en")) || voices[0];
    const chosen = prefer ?? null;
    const baseOpts: any = { rate: slow ? 0.85 : 1.0 };

    if (chosen) {
      const voiceId = chosen.identifier ?? chosen.id ?? chosen.voice;
      const voiceLang = chosen.language ?? chosen.locale ?? undefined;

      if (voiceId && voiceLang) {
        const opts = { ...baseOpts, voice: voiceId, language: voiceLang };
        try { Speech.speak(textToSpeak, opts); return; } catch (_) {}
      }

      if (voiceId) {
        const opts = { ...baseOpts, voice: voiceId };
        try { Speech.speak(textToSpeak, opts); return; } catch (_) {}
      }
    }

    // final fallback
    try { Speech.speak(textToSpeak, baseOpts); } catch (e) { console.warn("TTS: final speak failed", e); }
  } catch (err) {
    console.error("TTS: speakWithBestVoice unexpected error:", err);
  }
}
