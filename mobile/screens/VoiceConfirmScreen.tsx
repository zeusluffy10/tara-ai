import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { RootStackParamList } from "../types/navigation";
import { useSeniorMode } from "../context/SeniorModeContext";
import { unlockAudio } from "../utils/audioUnlock";
import { speakLoud, stopSpeakLoud } from "../utils/tts_loud";

type Props = StackScreenProps<RootStackParamList, "VoiceConfirm">;

export default function VoiceConfirmScreen({ route, navigation }: Props) {
  const { text } = route.params;
  const { settings } = useSeniorMode();

  // Speak once on mount
  useEffect(() => {
    (async () => {
      try {
        await stopSpeakLoud();
        await speakLoud(`Pupunta ka ba sa, ${text}?`, {
          voice: settings.ttsVoice || "nova",
          gender: settings.ttsGender,
          style: "calm",
          emphasis: settings.ttsEmphasis,
          pauseMs: settings.ttsPauseMs,
        });
      } catch (e) {
        console.warn("VoiceConfirm initial TTS failed:", e);
      }
    })();

    return () => {
      stopSpeakLoud().catch(() => {});
    };
  }, [text, settings.ttsVoice]);

  async function confirm() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await unlockAudio();
      await stopSpeakLoud();
      await speakLoud(`Okay. Dadalhin kita sa ${text}.`, {
        voice: settings.ttsVoice || "nova",
        gender: settings.ttsGender,
        style: "calm",
        emphasis: settings.ttsEmphasis,
        pauseMs: settings.ttsPauseMs,
      });
      navigation.navigate("SearchNavigateFlow", { initialQuery: text });
    } catch (e) {
      console.warn("confirm error:", e);
    }
  }

  async function playLoud() {
    await stopSpeakLoud();
    await speakLoud(`Pupunta ka ba sa, ${text}?`, {
      voice: settings.ttsVoice || "nova",
      gender: settings.ttsGender,
      style: "calm",
      emphasis: settings.ttsEmphasis,
      pauseMs: settings.ttsPauseMs,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={async () => {
            await stopSpeakLoud();
            navigation.goBack();
          }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color="#7C9FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="location" size={16} color="#7C9FFF" />
          <Text style={styles.headerTitle}>TARA-AI</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* MAIN CONTENT */}
      <View style={styles.content}>

        {/* ICON */}
        <View style={styles.iconCircle}>
          <Ionicons name="location" size={40} color="#7C9FFF" />
        </View>

        {/* QUESTION */}
        <Text style={[styles.question, settings.bigText && { fontSize: 28 }]}>
          Pupunta ka ba sa
        </Text>

        {/* DESTINATION */}
        <View style={styles.destinationBox}>
          <Text
            style={[styles.destination, settings.bigText && { fontSize: 26 }]}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {text}
          </Text>
        </View>

        {/* PLAY LOUD */}
        <TouchableOpacity
          style={styles.loudBtn}
          onPress={playLoud}
          activeOpacity={0.8}
        >
          <Ionicons name="volume-high" size={20} color="#7C9FFF" />
          <Text style={styles.loudText}>Play Loud</Text>
        </TouchableOpacity>

        {/* ACTION BUTTONS */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.noBtn]}
            activeOpacity={0.85}
            onPress={async () => {
              await stopSpeakLoud();
              navigation.goBack();
            }}
          >
            <Ionicons name="close" size={28} color="#FFF" />
            <Text style={styles.actionText}>Hindi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.yesBtn]}
            activeOpacity={0.85}
            onPress={confirm}
          >
            <Ionicons name="checkmark" size={28} color="#FFF" />
            <Text style={styles.actionText}>Oo</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

/* ── STYLES ── */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2D2D4A",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#C8D0FF",
    letterSpacing: 1,
    marginLeft: 6,
  },

  /* CONTENT */
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 20,
  },

  /* ICON */
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#1E2545",
    borderWidth: 2,
    borderColor: "#3A3A5C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  /* QUESTION */
  question: {
    fontSize: 24,
    fontWeight: "700",
    color: "#8892AA",
    textAlign: "center",
  },

  /* DESTINATION */
  destinationBox: {
    backgroundColor: "#252540",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#3A3A5C",
    width: "100%",
    alignItems: "center",
  },
  destination: {
    fontSize: 24,
    fontWeight: "800",
    color: "#7C9FFF",
    textAlign: "center",
    lineHeight: 32,
  },

  /* PLAY LOUD */
  loudBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1E2545",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A3A5C",
  },
  loudText: {
    color: "#7C9FFF",
    fontSize: 16,
    fontWeight: "600",
  },

  /* ACTIONS */
  actions: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  yesBtn: {
    backgroundColor: "#22C55E",
  },
  noBtn: {
    backgroundColor: "#EF4444",
  },
  actionText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
  },
});
