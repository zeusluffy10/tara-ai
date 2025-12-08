// mobile/screens/VoiceSettingsScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import * as Speech from "expo-speech";
import { savePreferredVoiceId, loadPreferredVoiceId } from "../utils/voiceStore.ts";

export default function VoiceSettingsScreen() {
  const [voices, setVoices] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const list = (await (Speech as any).getAvailableVoicesAsync?.()) || [];
      setVoices(list);
      const pref = await loadPreferredVoiceId();
      setSelected(pref);
    })();
  }, []);

  async function choose(voiceId: string) {
    setSelected(voiceId);
    await savePreferredVoiceId(voiceId);
    Alert.alert("Saved", "Preferred voice updated!");
  }

  function renderItem({ item }: { item: any }) {
    const id = item.identifier ?? item.id ?? item.voice;
    const label = `${item.name} (${item.language})`;
    const isSel = id === selected;

    return (
      <TouchableOpacity style={[styles.row, isSel && styles.sel]} onPress={() => choose(id)}>
        <Text style={{ fontWeight: isSel ? "700" : "400" }}>{label}</Text>

        <TouchableOpacity
          onPress={() => {
            try { Speech.stop(); } catch {}
            Speech.speak("Testing voice", { voice: id });
          }}
        >
          <Text style={{ color: "#007bff" }}>Test</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Choose TTS Voice</Text>

      <FlatList
        data={voices}
        keyExtractor={(v) => (v.identifier ?? v.id ?? v.voice)}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
