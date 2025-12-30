import { Audio } from "expo-av";

let unlocked = false;

export async function unlockAudio() {
  if (unlocked) return;

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
  });

  unlocked = true;
}