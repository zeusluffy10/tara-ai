import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { Audio } from "expo-av";
import { RootStackParamList } from "../types/navigation";
import { useSeniorMode } from "../context/SeniorModeContext";

type Props = StackScreenProps<RootStackParamList, "VoiceConfirm">;

let soundRef: Audio.Sound | null = null;

async function playLOUD(text: string) {
  // stop previous audio
  if (soundRef) {
    try {
      await soundRef.stopAsync();
      await soundRef.unloadAsync();
    } catch {}
    soundRef = null;
  }

  // 🔴 IMPORTANT: use LOCAL IP (no Cloudflare for now)
  const res = await fetch("https://lying-liable-wales-led.trycloudflare.com/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error("TTS server error");
  }

  const buffer = await res.arrayBuffer();
  const base64Audio = Buffer.from(buffer).toString("base64");

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: false,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri: `data:audio/mpeg;base64,${base64Audio}` },
    {
      shouldPlay: true,
      volume: 1.0, // 🔊 MAX LOUD
    }
  );

  soundRef = sound;
}

export default function VoiceConfirmScreen({ route, navigation }: Props) {
  const { text } = route.params;
  const { settings } = useSeniorMode();

  useEffect(() => {
    playLOUD(`Pupunta ka ba sa ${text}?`).catch(console.warn);
  }, []);

  async function confirm() {
    try {
      await playLOUD(`Okay. Dadalhin kita sa ${text}.`);
      navigation.navigate("SearchNavigateFlow", { initialQuery: text });
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={[styles.question, settings.bigText && { fontSize: 28 }]}>
          Pupunta ka ba sa
        </Text>

        <Text style={[styles.address, settings.bigText && { fontSize: 26 }]}>
          {text}
        </Text>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#28A745" }]}
            onPress={confirm}
          >
            <Text style={styles.btnText}>Oo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#DC3545" }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.btnText}>Hindi</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.loudBtn} onPress={() => playLOUD(text)}>
          <Text style={styles.loudText}>🔊 Play Loud</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 16 },
  card: { padding: 20, borderRadius: 12, alignItems: "center" },
  question: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  address: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 18,
    textAlign: "center",
  },
  row: { flexDirection: "row", width: "100%", justifyContent: "space-around" },
  btn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  loudBtn: {
    marginTop: 18,
    backgroundColor: "#000",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  loudText: { color: "#fff", fontWeight: "700" },
});
