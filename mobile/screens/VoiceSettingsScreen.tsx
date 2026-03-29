// mobile/screens/VoiceSettingsScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";

import { useSeniorMode } from "../context/SeniorModeContext";
import {
  getDefaultVoiceForGender,
  loadSeniorSlowVoice,
  loadTtsEmphasis,
  loadTtsGender,
  loadTtsPauseMs,
  loadTtsVoice,
  saveSeniorSlowVoice,
  saveTtsEmphasis,
  saveTtsGender,
  saveTtsPauseMs,
  saveTtsVoice,
  TtsEmphasis,
  TtsGender,
} from "../utils/voiceStore";
import { speakTagalog } from "../utils/speak"; // ✅ uses backend /tts

type VoiceOption = {
  id: string;
  label: string;
  subtitle: string;
  gender: "female" | "male" | "neutral";
};

const OPENAI_VOICES: VoiceOption[] = [
  { id: "nova", label: "Nova", subtitle: "Warm and natural for Tagalog guidance", gender: "female" },
  { id: "onyx", label: "Onyx", subtitle: "Deep and steady for clear warnings", gender: "male" },
  { id: "alloy", label: "Alloy", subtitle: "Balanced fallback voice", gender: "neutral" },
];

const PAUSE_OPTIONS = [
  { value: 140, label: "Crisp", subtitle: "Short pauses for faster prompts" },
  { value: 280, label: "Natural", subtitle: "Balanced spacing for everyday navigation" },
  { value: 420, label: "Relaxed", subtitle: "Longer pauses for seniors and noisy streets" },
];

const EMPHASIS_OPTIONS: Array<{ value: TtsEmphasis; label: string; subtitle: string }> = [
  { value: "low", label: "Light", subtitle: "Softest delivery" },
  { value: "medium", label: "Natural", subtitle: "Balanced navigation tone" },
  { value: "high", label: "Strong", subtitle: "Adds stronger cues for turns and warnings" },
];

export default function VoiceSettingsScreen() {
  const { settings, setSettings, seniorMode } = useSeniorMode();

  const [selected, setSelected] = useState<string>(settings.ttsVoice || getDefaultVoiceForGender("female"));
  const [gender, setGender] = useState<TtsGender>(settings.ttsGender || "female");
  const [pauseMs, setPauseMs] = useState<number>(settings.ttsPauseMs || 280);
  const [emphasis, setEmphasis] = useState<TtsEmphasis>(settings.ttsEmphasis || "medium");
  const [seniorSlowVoice, setSeniorSlowVoiceState] = useState<boolean>(true);
  const [testing, setTesting] = useState(false);

  const visibleVoices = OPENAI_VOICES.filter((voice) => voice.gender === gender || voice.gender === "neutral");

  useEffect(() => {
    (async () => {
      try {
        const savedVoice = await loadTtsVoice();
        if (savedVoice) {
          setSelected(savedVoice);
          setSettings({ ttsVoice: savedVoice });
        }
      } catch {}

      try {
        const savedGender = await loadTtsGender();
        setGender(savedGender);
        setSettings({ ttsGender: savedGender });
      } catch {}

      try {
        const savedPauseMs = await loadTtsPauseMs();
        setPauseMs(savedPauseMs);
        setSettings({ ttsPauseMs: savedPauseMs });
      } catch {}

      try {
        const savedEmphasis = await loadTtsEmphasis();
        setEmphasis(savedEmphasis);
        setSettings({ ttsEmphasis: savedEmphasis });
      } catch {}

      try {
        const slow = await loadSeniorSlowVoice();
        setSeniorSlowVoiceState(slow);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(voiceId: string) {
    try {
      setSelected(voiceId);
      setSettings({ ttsVoice: voiceId });
      await saveTtsVoice(voiceId);
      Alert.alert("Saved", "Voice updated!");
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  }

  async function chooseGender(nextGender: TtsGender) {
    try {
      const recommendedVoice = getDefaultVoiceForGender(nextGender);
      setGender(nextGender);
      setSelected(recommendedVoice);
      setSettings({ ttsGender: nextGender, ttsVoice: recommendedVoice });
      await saveTtsGender(nextGender);
      await saveTtsVoice(recommendedVoice);
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  }

  async function choosePause(nextPauseMs: number) {
    try {
      setPauseMs(nextPauseMs);
      setSettings({ ttsPauseMs: nextPauseMs });
      await saveTtsPauseMs(nextPauseMs);
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  }

  async function chooseEmphasis(nextEmphasis: TtsEmphasis) {
    try {
      setEmphasis(nextEmphasis);
      setSettings({ ttsEmphasis: nextEmphasis });
      await saveTtsEmphasis(nextEmphasis);
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  }

  async function testVoice(style: "calm" | "warning") {
    try {
      setTesting(true);

      const sample =
        style === "warning"
          ? "Sa 10 metro, lumiko pakaliwa. Malapit sa BDO. Mag-ingat."
          : "Sa 20 metro, lumiko pakaliwa. Malapit sa Jollibee. Dahan-dahan lang.";

      await speakTagalog(sample, {
        voice: selected,
        gender,
        style,
        emphasis,
        pauseMs,
      });
    } catch (e) {
      Alert.alert("Test failed", String(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Settings</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>OpenAI Tagalog Voice</Text>

        <View style={styles.toggleRow}>
          {(["female", "male"] as TtsGender[]).map((option) => {
            const active = option === gender;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => chooseGender(option)}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {option === "female" ? "Female" : "Male"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.subheading}>Voice timbre</Text>

        {visibleVoices.map((v) => {
          const isSel = v.id === selected;
          return (
            <TouchableOpacity
              key={v.id}
              style={[styles.voiceRow, isSel && styles.voiceRowSelected]}
              onPress={() => choose(v.id)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.voiceLabel, isSel && { fontWeight: "800" }]}>{v.label}</Text>
                <Text style={styles.voiceSub}>{v.subtitle}</Text>
              </View>

              <Text style={[styles.badge, isSel && styles.badgeSelected]}>{isSel ? "Selected" : "Select"}</Text>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.subheading}>Pause control</Text>
        {PAUSE_OPTIONS.map((option) => {
          const active = option.value === pauseMs;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.voiceRow, active && styles.voiceRowSelected]}
              onPress={() => choosePause(option.value)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.voiceLabel, active && { fontWeight: "800" }]}>{option.label}</Text>
                <Text style={styles.voiceSub}>{option.subtitle}</Text>
              </View>

              <Text style={[styles.badge, active && styles.badgeSelected]}>{active ? "Selected" : `${option.value} ms`}</Text>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.subheading}>Emphasis</Text>
        {EMPHASIS_OPTIONS.map((option) => {
          const active = option.value === emphasis;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.voiceRow, active && styles.voiceRowSelected]}
              onPress={() => chooseEmphasis(option.value)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.voiceLabel, active && { fontWeight: "800" }]}>{option.label}</Text>
                <Text style={styles.voiceSub}>{option.subtitle}</Text>
              </View>

              <Text style={[styles.badge, active && styles.badgeSelected]}>{active ? "Selected" : "Select"}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.testRow}>
          <TouchableOpacity
            style={[styles.testBtn, testing && { opacity: 0.6 }]}
            disabled={testing}
            onPress={() => testVoice("calm")}
          >
            <Text style={styles.testText}>Test Calm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testBtnWarn, testing && { opacity: 0.6 }]}
            disabled={testing}
            onPress={() => testVoice("warning")}
          >
            <Text style={styles.testText}>Test Warning</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          *This uses your backend TTS so you hear the real Tagalog pronunciation (not iOS default voice).
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Accessibility</Text>

        <TouchableOpacity
          style={[
            styles.toggle,
            { backgroundColor: seniorSlowVoice ? "#34C759" : "#8E8E93" },
          ]}
          onPress={async () => {
            const v = !seniorSlowVoice;
            setSeniorSlowVoiceState(v);
            await saveSeniorSlowVoice(v);
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.toggleText}>
            Senior Ultra-Slow Voice: {seniorSlowVoice ? "ON" : "OFF"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          When Senior Mode is ON, your app forces safer pacing. (Voice choice still applies.)
        </Text>

        <Text style={[styles.note, { marginTop: 6 }]}>
          Senior Mode: {seniorMode ? "ON" : "OFF"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F6F8FF" },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 12, color: "#0A84FF" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
  subheading: { fontSize: 13, fontWeight: "800", color: "#344054", marginTop: 12, marginBottom: 8 },

  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  segmentBtnActive: {
    backgroundColor: "#0A84FF",
    borderColor: "#0A84FF",
  },
  segmentText: { fontWeight: "800", color: "#344054" },
  segmentTextActive: { color: "#FFF" },

  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    marginBottom: 10,
  },
  voiceRowSelected: {
    borderColor: "#0A84FF",
    backgroundColor: "#EEF6FF",
  },
  voiceLabel: { fontSize: 16, fontWeight: "700" },
  voiceSub: { marginTop: 2, fontSize: 12, color: "#667085" },

  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "800",
    color: "#0A84FF",
    backgroundColor: "#EEF6FF",
  },
  badgeSelected: {
    color: "#fff",
    backgroundColor: "#0A84FF",
  },

  testRow: { flexDirection: "row", gap: 10 },
  testBtn: {
    flex: 1,
    backgroundColor: "#0A84FF",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  testBtnWarn: {
    flex: 1,
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  testText: { color: "#fff", fontWeight: "800" },

  toggle: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  toggleText: { color: "#fff", fontWeight: "900" },

  note: { marginTop: 8, color: "#667085", fontSize: 12 },
});
