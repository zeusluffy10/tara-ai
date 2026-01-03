// mobile/screens/VoiceSettingsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import * as Speech from "expo-speech";

import {
  savePreferredVoiceId,
  loadPreferredVoiceId,
  saveSeniorSlowVoice,
  loadSeniorSlowVoice,
} from "../utils/voiceStore";
import { useSeniorMode } from "../context/SeniorModeContext";

export default function VoiceSettingsScreen() {
  const [voices, setVoices] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [seniorSlowVoice, setSeniorSlowVoice] = useState<boolean>(true);
  const { seniorMode } = useSeniorMode();

  // ===========================
  // LOAD DATA
  // ===========================
  useEffect(() => {
    (async () => {
      const list =
        (await (Speech as any).getAvailableVoicesAsync?.()) || [];
      setVoices(list);

      const pref = await loadPreferredVoiceId();
      setSelected(pref);

      const slow = await loadSeniorSlowVoice();
      setSeniorSlowVoice(slow);
    })();
  }, []);

  // ===========================
  // SAVE VOICE
  // ===========================
  async function choose(voiceId: string) {
    setSelected(voiceId);
    await savePreferredVoiceId(voiceId);
    Alert.alert("Saved", "Preferred voice updated!");
  }

  // ===========================
  // RENDER VOICE ROW
  // ===========================
  function renderItem({ item }: { item: any }) {
    const id = item.identifier ?? item.id ?? item.voice;
    const label = `${item.name} (${item.language})`;
    const isSel = id === selected;

    return (
      <TouchableOpacity
        style={[styles.row, isSel && styles.sel]}
        onPress={() => choose(id)}
        activeOpacity={0.8}
      >
        <Text style={{ fontWeight: isSel ? "700" : "400" }}>
          {label}
        </Text>

        <TouchableOpacity
          onPress={() => {
            try {
              Speech.stop();
            } catch {}

            Speech.speak("Testing voice", {
              voice: id,
              rate: seniorSlowVoice ? 0.65 : 0.8,
              pitch: 0.95,
              volume: 1.0,
            });
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: "#007bff", fontWeight: "600" }}>
            Test
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // ===========================
  // RENDER
  // ===========================
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>Choose TTS Voice</Text>

      {/* ACCESSIBILITY */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accessibility</Text>

        <TouchableOpacity
          style={[
            styles.toggle,
            { backgroundColor: seniorSlowVoice ? "#34C759" : "#8E8E93" },
          ]}
          onPress={async () => {
            const v = !seniorSlowVoice;
            setSeniorSlowVoice(v);
            await saveSeniorSlowVoice(v);
          }}
        >
          <Text style={styles.toggleText}>
            Senior Ultra-Slow Voice: {seniorSlowVoice ? "ON" : "OFF"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Recommended for seniors. Slower, clearer voice guidance.
        </Text>
      </View>

      {/* VOICE LIST */}
      <FlatList
        data={voices}
        keyExtractor={(v) => v.identifier ?? v.id ?? v.voice}
        renderItem={renderItem}
      />
    </View>
  );
}

// ===========================
// STYLES
// ===========================
const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sel: {
    backgroundColor: "#eaf4ff",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  toggle: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleText: {
    color: "#fff",
    fontWeight: "700",
  },
  note: {
    marginTop: 6,
    color: "#555",
    fontSize: 12,
  },
});
