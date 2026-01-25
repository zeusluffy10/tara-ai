import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { RootStackParamList } from "../types/navigation";
import { useSeniorMode } from "../context/SeniorModeContext";
import { unlockAudio } from "../utils/audioUnlock";
import { speakTagalog } from "../utils/speak";

type Props = StackScreenProps<RootStackParamList, "VoiceConfirm">;

let sound: Audio.Sound | null = null;

/* 🔊 LOUD TTS (UNCHANGED LOGIC, SAFE) */
async function playLOUD(text: string) {
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {}
    sound = null;
  }

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: false,
  });

  const url =
    "https://tara-ai-backend-swbp.onrender.com/tts?lang=fil&text=" +
    encodeURIComponent(text);

  const result = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true, volume: 1.0 }
  );

  sound = result.sound;
}

export default function VoiceConfirmScreen({ route, navigation }: Props) {
  const { text } = route.params;
  const { settings } = useSeniorMode();

  useEffect(() => {
    speakTagalog(`Pupunta ka ba sa ${text}?`, {
      voice: settings.ttsVoice,
      style: "calm",
    }).catch(console.warn);
  }, []);

  useEffect(() => {
    playLOUD(`Pupunta ka ba sa ${text}?`).catch(console.warn);
  }, []);

  async function confirm() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await unlockAudio();
      await playLOUD(`Okay. Dadalhin kita sa ${text}.`);
      navigation.navigate("SearchNavigateFlow", { initialQuery: text });
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  }

  return (
    <LinearGradient
      colors={["#EAF2FF", "#DDEBFF"]}
      style={styles.container}
    >
      {/* CARD */}
      <View style={styles.card}>
        {/* ICON */}
        <View style={styles.iconCircle}>
          <Ionicons name="location" size={36} color="#0A84FF" />
        </View>

        {/* QUESTION */}
        <Text
          style={[
            styles.question,
            settings.bigText && { fontSize: 30 },
          ]}
        >
          Pupunta ka ba sa
        </Text>

        {/* DESTINATION */}
        <Text
          style={[
            styles.address,
            settings.bigText && { fontSize: 28 },
          ]}
        >
          {text}
        </Text>

        {/* ACTIONS */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.yesBtn]}
            onPress={confirm}
          >
            <Ionicons name="checkmark" size={28} color="#FFF" />
            <Text style={styles.actionText}>Oo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.noBtn]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={28} color="#FFF" />
            <Text style={styles.actionText}>Hindi</Text>
          </TouchableOpacity>
        </View>

        {/* PLAY LOUD */}
        <TouchableOpacity
          style={styles.loudBtn}
          onPress={() =>
            playLOUD(`Pupunta ka ba sa ${text}?`)
          }
        >
          <Ionicons name="volume-high" size={22} color="#0A84FF" />
          <Text style={styles.loudText}>Play Loud</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 28,
    padding: 26,
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E6F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  question: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 10,
  },

  address: {
    fontSize: 22,
    fontWeight: "600",
    color: "#0A84FF",
    textAlign: "center",
    marginBottom: 26,
  },

  actions: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  actionBtn: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginHorizontal: 6,
  },

  yesBtn: {
    backgroundColor: "#34C759",
  },

  noBtn: {
    backgroundColor: "#FF3B30",
  },

  actionText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
    marginLeft: 8,
  },

  loudBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F5FF",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
  },

  loudText: {
    color: "#0A84FF",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
});
