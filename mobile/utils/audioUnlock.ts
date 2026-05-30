import { AudioModule } from "expo-audio";

let unlocked = false;

export async function unlockAudio() {
  if (unlocked) return;
  await AudioModule.setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
  });
  unlocked = true;
}