// mobile/screens/VoiceConfirmScreen.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { speakWithBestVoice } from "../utils/ttts";
import { useSeniorMode } from "../context/SeniorModeContext";
import { RootStackParamList } from "../types/navigation";
import { playServerTTS } from "../utils/tts_server";
import { startTtsJob, waitForTts, downloadAndPlay } from "../utils/tts_job_client";

type Props = StackScreenProps<RootStackParamList, "VoiceConfirm">;

export default function VoiceConfirmScreen({ route, navigation }: Props) {
  const { text } = route.params;
  const { settings } = useSeniorMode();

  React.useEffect(() => {
    const question = `Pupunta ka ba sa ${text}? — Are you going to ${text}?`;
    // speak on mount (prefer device TTS)
    speakWithBestVoice(question, settings.slowTts, 1.05).catch((e) =>
      console.warn("initial speak failed", e)
    );

    // stop on unmount
    return () => {
      try {
        // best-effort stop (expo-speech may be in use)
        (async () => {
          const Speech = await import("expo-speech").then((m) => m.default || m);
          try { Speech.stop(); } catch {}
        })();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function playLoud() {
    try {
      Alert.alert("DEBUG", "Starting TTS job...");
      const { job_id } = await startTtsJob(`Ok. Dadalhin kita sa ${text}.`, undefined);
      console.log("DEBUG: job created", job_id);
      // optionally show spinner in UI while waiting
      await waitForTts(job_id, 1500, 60000); // 60s timeout
      console.log("DEBUG: job ready, downloading...");
      await downloadAndPlay(job_id);
      Alert.alert("DEBUG", "Played job audio");
    } catch (e) {
      console.error("playLoud job error", e);
      Alert.alert("Play Loud error", String(e));
    }
  }

  async function confirm() {
    try {
      Alert.alert("DEBUG", "Oo pressed");
      const confirmMsg = `Ok. Dadalhin kita sa ${text.replace(/-/g, " ")}. — I will take you to ${text}.`;
      // prefer on-device TTS for speed
      await speakWithBestVoice(confirmMsg, settings.slowTts, 1.07);
      navigation.navigate("SearchNavigateFlow", { initialQuery: text });
    } catch (err) {
      console.error("confirm error", err);
      Alert.alert("Error", String(err));
    }
  }

  // async function playLoud() {
  //   try {
  //     Alert.alert("DEBUG", "Play Loud pressed");
  //     const loudMsg = `Ok. Dadalhin kita sa ${text.replace(/-/g, " ")}. — I will take you to ${text}.`;
  //     // force server TTS => guaranteed loud playback
  //     await speakWithBestVoice(loudMsg, settings.slowTts, 1.0, {
  //       forceServer: true,
  //       serverVoiceId: undefined,
  //       volume: 1.0,
  //     });
  //   } catch (err) {
  //     console.error("playLoud error", err);
  //     Alert.alert("Play Loud error", String(err));
  //   }
  // }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={[styles.question, settings.bigText && { fontSize: 28 }]}>Pupunta ka ba sa</Text>
        <Text style={[styles.address, settings.bigText && { fontSize: 26 }]}>{text}</Text>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#28A745" }]}
            onPress={confirm}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Oo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#DC3545" }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Hindi</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.loudBtn} onPress={playLoud} activeOpacity={0.85}>
          <Text style={styles.loudText}>Play Loud</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#fff" },
  card: { backgroundColor: "#fff", padding: 20, borderRadius: 12, alignItems: "center", elevation: 3 },
  question: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  address: { fontSize: 20, fontWeight: "600", marginBottom: 18, textAlign: "center" },
  row: { flexDirection: "row", width: "100%", justifyContent: "space-around" },
  btn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  loudBtn: {
    marginTop: 18,
    backgroundColor: "#111",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  loudText: { color: "#fff", fontWeight: "700" },
});
