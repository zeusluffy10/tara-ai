// mobile/screens/VoiceSettingsScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";

import { useSeniorMode } from "../context/SeniorModeContext";
import { saveTtsVoice, loadTtsVoice, saveSeniorSlowVoice, loadSeniorSlowVoice } from "../utils/voiceStore";
import { speakTagalog } from "../utils/speak"; // ✅ uses backend /tts

type VoiceOption = {
  id: string;
  label: string;
  subtitle: string;
};

const OPENAI_VOICES: VoiceOption[] = [
  { id: "alloy", label: "Voice A", subtitle: "Default (clear & friendly)" },
  { id: "nova", label: "Voice B", subtitle: "Softer tone" },
  { id: "onyx", label: "Voice C", subtitle: "Deeper tone" },
];

export default function VoiceSettingsScreen() {
  const { settings, setSettings, seniorMode } = useSeniorMode();

  const [selected, setSelected] = useState<string>(settings.ttsVoice || "alloy");
  const [seniorSlowVoice, setSeniorSlowVoiceState] = useState<boolean>(true);
  const [testing, setTesting] = useState(false);

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

  async function testVoice(style: "calm" | "warning") {
    try {
      setTesting(true);

      // ✅ Test in FULL Tagalog (and includes a word that often gets mispronounced)
      const sample =
        style === "warning"
          ? "Lumihis ka sa daan. Dahan-dahan. Kumain muna kung kailangan."
          : "Okay. Pupunta tayo sa destinasyon. Dahan-dahan lang. Kumain muna kung kailangan.";

      await speakTagalog(sample, {
        voice: selected,
        style,
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

        {OPENAI_VOICES.map((v) => {
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
