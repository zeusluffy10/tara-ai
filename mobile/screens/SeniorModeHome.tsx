import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Animated,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useSeniorMode } from "../context/SeniorModeContext";
import { emergencyCall, shareLiveLocation } from "../components/EmergencyShare";
import { RootStackParamList } from "../types/navigation";

type Props = StackScreenProps<RootStackParamList, "SeniorModeHome">;

/* ---------- HELPERS ---------- */

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 18) return "Good afternoon!";
  return "Good evening!";
};

const getDate = (): string =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

/* ---------- MAIN SCREEN ---------- */

export default function SeniorModeHome({ navigation }: Props) {
  const { settings, setSettings } = useSeniorMode();

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();

    animate(ring1, 0);
    animate(ring2, 500);
  }, []);

  const ringStyle = (val: Animated.Value) => ({
    opacity: val.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0, 0] }),
    transform: [
      { scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) },
    ],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="location" size={20} color="#7C9FFF" />
            <Text style={styles.appName}>TARA-AI</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="accessibility" size={13} color="#7C9FFF" />
            <Text style={styles.badgeText}>Senior Mode ON</Text>
          </View>
        </View>

        {/* ── GREETING ── */}
        <View style={styles.greetingBlock}>
          <Text style={styles.dateText}>{getDate()}</Text>
          <Text style={styles.greetingText}>{getGreeting()}</Text>
          <Text style={styles.subtitleText}>Where would you like to go?</Text>
        </View>

        {/* ── HERO MIC BUTTON ── */}
        <View style={styles.heroContainer}>
          <Animated.View style={[styles.ringOuter, ringStyle(ring2)]} />
          <Animated.View style={[styles.ringInner, ringStyle(ring1)]} />
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.heroButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              navigation.navigate("VoiceRecorder");
            }}
          >
            <Ionicons name="mic" size={42} color="#FFF" />
            <Text style={styles.heroText}>Speak</Text>
          </TouchableOpacity>
        </View>

        {/* ── SEARCH BAR ── */}
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate("SearchNavigateFlow", { initialQuery: "" })
          }
        >
          <Ionicons name="search" size={22} color="#7C9FFF" />
          <Text style={styles.searchText}>Type destination…</Text>
        </TouchableOpacity>

        {/* ── QUICK SHORTCUTS ── */}
        <View style={styles.shortcutRow}>
          <TouchableOpacity
            style={styles.shortcutCard}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate("SearchNavigateFlow", { initialQuery: "Home" })
            }
          >
            <View style={styles.shortcutIcon}>
              <Ionicons name="home-outline" size={24} color="#7C9FFF" />
            </View>
            <Text style={styles.shortcutLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutCard, styles.emergencyCard]}
            activeOpacity={0.8}
            onPress={emergencyCall}
          >
            <View style={[styles.shortcutIcon, styles.emergencyIcon]}>
              <Ionicons name="call" size={24} color="#FF6B6B" />
            </View>
            <Text style={[styles.shortcutLabel, styles.emergencyLabel]}>
              Emergency
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── ACCESSIBILITY CARD ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="accessibility" size={18} color="#7C9FFF" />
            <Text style={styles.cardTitle}>Accessibility</Text>
          </View>

          <SettingRow
            icon="contrast-outline"
            label="High Contrast"
            value={settings.highContrast}
            onToggle={(v) => setSettings({ highContrast: v })}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="volume-medium-outline"
            label="Slow Speech"
            value={settings.slowTts}
            onToggle={(v) => setSettings({ slowTts: v })}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="repeat-outline"
            label="Auto Repeat"
            value={settings.autoRepeat}
            onToggle={(v) => setSettings({ autoRepeat: v })}
          />
        </View>

        {/* ── BOTTOM UTILITY STRIP ── */}
        <View style={styles.utilityStrip}>
          <TouchableOpacity
            style={styles.utilityItem}
            onPress={shareLiveLocation}
          >
            <Ionicons name="share-outline" size={26} color="#7C9FFF" />
            <Text style={styles.utilityText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.utilityItem}
            onPress={() => navigation.navigate("VoiceSettings" as never)}
          >
            <Ionicons name="volume-high-outline" size={26} color="#7C9FFF" />
            <Text style={styles.utilityText}>Voice</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.utilityItem}
            onPress={() => navigation.navigate("Settings" as never)}
          >
            <Ionicons name="settings-outline" size={26} color="#7C9FFF" />
            <Text style={styles.utilityText}>Settings</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- SETTING ROW ---------- */

function SettingRow({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: string;
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
      <View style={styles.rowLeft}>
        <Ionicons name={icon as any} size={22} color="#5A6480" />
        <Text style={styles.rowText}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#2D2D4A", true: "#4A4AFF" }}
        thumbColor={value ? "#FFFFFF" : "#5A6480"}
        ios_backgroundColor="#2D2D4A"
      />
    </TouchableOpacity>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  scroll: {
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  appName: {
    fontSize: 19,
    fontWeight: "700",
    color: "#C8D0FF",
    letterSpacing: 1,
    marginLeft: 6,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E2545",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#2D3A6A",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#7C9FFF",
    marginLeft: 4,
  },

  /* GREETING */
  greetingBlock: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  dateText: {
    fontSize: 14,
    color: "#5A6480",
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#E8EEFF",
    lineHeight: 34,
  },
  subtitleText: {
    fontSize: 16,
    color: "#8892AA",
    marginTop: 5,
  },

  /* HERO */
  heroContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 180,
    marginBottom: 8,
  },
  ringOuter: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: "rgba(124,159,255,0.3)",
  },
  ringInner: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "rgba(124,159,255,0.45)",
  },
  heroButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#4A4AFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  heroText: {
    color: "#C8D0FF",
    fontSize: 14,
    fontWeight: "600",
  },

  /* SEARCH */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252540",
    marginHorizontal: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#3A3A5C",
    gap: 12,
    marginBottom: 14,
  },
  searchText: {
    fontSize: 18,
    color: "#4A5070",
  },

  /* SHORTCUTS */
  shortcutRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 14,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: "#252540",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#3A3A5C",
  },
  emergencyCard: {
    backgroundColor: "#3A1A1A",
    borderColor: "#5C2A2A",
  },
  shortcutIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#1E2545",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyIcon: {
    backgroundColor: "#5C2020",
  },
  shortcutLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#C8D0FF",
  },
  emergencyLabel: {
    color: "#FF9999",
  },

  /* ACCESSIBILITY CARD */
  card: {
    backgroundColor: "#252540",
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#3A3A5C",
    marginBottom: 14,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#C8D0FF",
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 52,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: {
    fontSize: 17,
    color: "#C8D0FF",
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#2D2D4A",
  },

  /* UTILITY STRIP */
  utilityStrip: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#252540",
    marginHorizontal: 20,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#3A3A5C",
  },
  utilityItem: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  utilityText: {
    fontSize: 13,
    color: "#8892AA",
    fontWeight: "500",
  },
});
