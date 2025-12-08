// mobile/screens/SeniorModeHome.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Switch } from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { useSeniorMode } from "../context/SeniorModeContext";
import EmergencyShare from "../components/EmergencyShare";
import { RootStackParamList } from "../types/navigation";
import { Audio } from "expo-av";

type Props = StackScreenProps<RootStackParamList, "SeniorModeHome">;

export default function SeniorModeHome({ navigation }: Props) {
  const { settings, setSettings } = useSeniorMode();


  return (
    <SafeAreaView style={[styles.container, settings.highContrast && { backgroundColor: "#000" }]}>
      <View style={styles.header}>
        <Text style={[styles.appName, settings.highContrast && { color: "#FFD700" }]}>TARA-AI</Text>
        <Text style={[styles.subtitle, settings.highContrast && { color: "#ccc" }]}>Senior Navigation Mode</Text>
      </View>

      <View style={styles.mainButtons}>
        <TouchableOpacity
          style={styles.bigButton}
          onPress={() => navigation.navigate("VoiceRecorder")}
        >
          <Text style={styles.bigButtonText}>🎤 Speak Destination</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bigButtonAlt}
          onPress={() => navigation.navigate("SearchNavigateFlow", { initialQuery: "" })}
        >
          <Text style={styles.bigButtonTextAlt}>🔍 Type Destination</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>Accessibility Settings</Text>

          <View style={styles.row}>
            <Text>High contrast</Text>
            <Switch value={settings.highContrast} onValueChange={(v) => setSettings({ highContrast: v })} />
          </View>

          <View style={styles.row}>
            <Text>Large text</Text>
            <Switch value={settings.bigText} onValueChange={(v) => setSettings({ bigText: v })} />
          </View>

          <View style={styles.row}>
            <Text>Slow speech</Text>
            <Switch value={settings.slowTts} onValueChange={(v) => setSettings({ slowTts: v })} />
          </View>

          <View style={styles.row}>
            <Text>Auto repeat when stopped</Text>
            <Switch value={settings.autoRepeat} onValueChange={(v) => setSettings({ autoRepeat: v })} />
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              onPress={() => navigation.navigate("VoiceSettings" as never)}
              style={{ marginTop: 12, backgroundColor:"#007bff", padding:12, borderRadius:10 }}
            >
              <Text style={{ color:"#fff", fontWeight:"700", textAlign:"center" }}>Voice Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <EmergencyShare />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5", paddingHorizontal: 20, paddingTop: 40 },
  header: { alignItems: "center", marginBottom: 18 },
  appName: { fontSize: 36, fontWeight: "800", color: "#007AFF" },
  subtitle: { fontSize: 18, marginTop: 6, color: "#555" },
  mainButtons: { flex: 1, justifyContent: "flex-start" },
  bigButton: { backgroundColor: "#007AFF", paddingVertical: 20, borderRadius: 16, marginBottom: 12, alignItems: "center" },
  bigButtonAlt: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#007AFF", paddingVertical: 18, borderRadius: 12, alignItems: "center" },
  bigButtonText: { color: "#fff", fontSize: 22, fontWeight: "600" },
  bigButtonTextAlt: { color: "#007AFF", fontSize: 20, fontWeight: "600" },
  footer: { paddingBottom: 30, alignItems: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
});
