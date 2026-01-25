// mobile/utils/speak.ts
import { Audio } from "expo-av";
import { unlockAudio } from "./audioUnlock";

type Style = "calm" | "warning";

let sound: Audio.Sound | null = null;

export async function speakTagalog(
  text: string,
  opts?: { voice?: string; style?: Style }
) {
  const voice = opts?.voice ?? "alloy";
  const style: Style = opts?.style ?? "calm";

  // stop previous
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {}
    sound = null;
  }

  await unlockAudio();

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: false,
  });

  const url =
    "https://tara-ai-backend-swbp.onrender.com/tts?text=" +
    encodeURIComponent(text) +
    "&voice=" +
    encodeURIComponent(voice) +
    "&style=" +
    encodeURIComponent(style);

  const result = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true, volume: 1.0 }
  );

  sound = result.sound;
}
