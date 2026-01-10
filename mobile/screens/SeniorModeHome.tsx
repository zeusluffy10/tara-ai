import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Animated,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useSeniorMode } from "../context/SeniorModeContext";
import { emergencyCall, shareLiveLocation } from "../components/EmergencyShare";
import { RootStackParamList } from "../types/navigation";
import { Linking, Alert } from "react-native";

type Props = StackScreenProps<RootStackParamList, "SeniorModeHome">;

export default function SeniorModeHome({ navigation }: Props) {
  const { settings, setSettings } = useSeniorMode();

  /* HERO PULSE ANIMATION */
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient
      colors={["#EAF2FF", "#DDEBFF"]}
      style={styles.safe}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.appName}>TARA-AI</Text>
        <Text style={styles.subtitle}>Navigation Assistant</Text>
      </View>

      {/* HERO MIC */}
      <View style={styles.heroContainer}>
        <View style={styles.glow} />
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.heroButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              navigation.navigate("VoiceRecorder");
            }}
          >
            <Ionicons name="mic" size={52} color="#FFF" />
            <Text style={styles.heroText}>Speak Destination</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* SECONDARY ACTION */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() =>
          navigation.navigate("SearchNavigateFlow", { initialQuery: "" })
        }
      >
        <Ionicons name="search" size={22} color="#0A84FF" />
        <Text style={styles.secondaryText}>Type Destination</Text>
      </TouchableOpacity>

      {/* ACCESSIBILITY CARD */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Accessibility</Text>

        <SettingRow
          label="High Contrast"
          value={settings.highContrast}
          onToggle={(v) => setSettings({ highContrast: v })}
        />
        <SettingRow
          label="Slow Speech"
          value={settings.slowTts}
          onToggle={(v) => setSettings({ slowTts: v })}
        />
        <SettingRow
          label="Auto Repeat"
          value={settings.autoRepeat}
          onToggle={(v) => setSettings({ autoRepeat: v })}
        />
      </View>

      {/* BOTTOM UTILITY STRIP (DEMO STYLE) */}
      <View style={styles.utilityStrip}>
        <TouchableOpacity
          style={styles.utilityItem}
          onPress={emergencyCall}
        >
          <Ionicons name="call-outline" size={22} color="#1C1C1E" />
          <Text style={styles.utilityText}>Emergency</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.utilityItem}
          onPress={shareLiveLocation}
        >
          <Ionicons name="location-outline" size={22} color="#1C1C1E" />
          <Text style={styles.utilityText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.utilityItem}
          onPress={() => navigation.navigate("VoiceSettings" as never)}
        >
          <Ionicons name="volume-high-outline" size={22} color="#1C1C1E" />
          <Text style={styles.utilityText}>Voice</Text>
        </TouchableOpacity>
      </View>


    </LinearGradient>
  );
}

/* ---------- SETTING ROW ---------- */

function SettingRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onToggle(!value)}
    >
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} />
    </TouchableOpacity>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  utilityStrip: {
    position: "absolute",
    bottom: 28,

    left: 24,
    right: 24,

    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 64,

    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  utilityItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 80,
  },

  utilityText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "500",
    color: "#1C1C1E",
  },


  safe: {
    flex: 1,
  },

  /* HEADER */
  header: {
    alignItems: "center",
    marginTop: 24,
  },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0A84FF",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 18,
    color: "#5F6C80",
    marginTop: 6,
  },

  /* HERO */
  heroContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 28,
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#0A84FF",
    opacity: 0.18,
  },
  heroButton: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 14,
  },
  heroText: {
    marginTop: 12,
    color: "#FFF",
    fontSize: 20,
    fontWeight: "700",
    marginVertical: 3,
  },

  /* SECONDARY */
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    marginHorizontal: 50,
    paddingVertical: 20,
    borderRadius: 18,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0A84FF",
    marginLeft: 10,
  },

  /* CARD */
  card: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    marginTop: 26,
    marginHorizontal: 16,
    padding: 16,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 56,
  },
  rowText: {
    fontSize: 18,
    fontWeight: "500",
  },

  /* VOICE SETTINGS */
  voiceSettings: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#F0F5FF",
  },
  voiceSettingsText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "600",
    color: "#0A84FF",
  },

  /* FOOTER */
  footer: {
    marginTop: "auto",
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
});
