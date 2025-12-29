import { Audio } from "expo-av";

let currentSound: Audio.Sound | null = null;

export async function speakLoudFromServer(text: string) {
  // stop previous audio
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {}
    currentSound = null;
  }

  const res = await fetch("https://tara-ai-backend-swbp.onrender.com/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error("TTS server failed");
  }

  const audioBytes = await res.arrayBuffer();
  const base64 = Buffer.from(audioBytes).toString("base64");

  const { sound } = await Audio.Sound.createAsync(
    { uri: `data:audio/mpeg;base64,${base64}` },
    {
      shouldPlay: true,
      volume: 1.0,       // 🔊 MAX volume
      rate: 1.0,
    }
  );

  currentSound = sound;
}
