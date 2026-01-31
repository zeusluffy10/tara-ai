// mobile/screens/NavigationMapScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Vibration,
} from "react-native";
import MapView, { Marker, Polyline, LatLng, PROVIDER_GOOGLE } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { StackScreenProps } from "@react-navigation/stack";

import decodePolyline from "../utils/polylineDecode";
import { RootStackParamList } from "../types/navigation";
import { speakLoud } from "../utils/tts_loud";
import { filipinoNavigator } from "../utils/filipinoNavigator";
import { getLandmarkName } from "../utils/landmark";
import { loadSeniorSlowVoice } from "../utils/voiceStore";
import { useSeniorMode } from "../context/SeniorModeContext";

type Props = StackScreenProps<RootStackParamList, "NavigationMapScreen">;
type NavMode = "walking" | "driving";

/** ✅ Works with multiple step shapes */
function getStepLatLng(step: any): { lat: number; lng: number } | null {
  const lat =
    step?.lat ??
    step?.end_location?.lat ??
    step?.endLocation?.lat ??
    step?.end_location?.latitude ??
    step?.endLocation?.latitude;

  const lng =
    step?.lng ??
    step?.end_location?.lng ??
    step?.endLocation?.lng ??
    step?.end_location?.longitude ??
    step?.endLocation?.longitude;

  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

export default function NavigationMapScreen({ route }: Props) {
  const { routeData } = route.params;

  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const announcedRef = useRef(false);
  const offRouteRef = useRef(false);

  const [polyCoords, setPolyCoords] = useState<LatLng[]>([]);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [eta, setEta] = useState("1 min");

  const destination = routeData?.destination;

  const [currentSteps, setCurrentSteps] = useState<any[]>(routeData?.steps ?? []);
  const steps = currentSteps;

  const [currentLandmark, setCurrentLandmark] = useState<string | null>(null);
  const lastLandmarkKeyRef = useRef<string | null>(null);

  const lastRerouteRef = useRef<number>(0);
  const REROUTE_COOLDOWN_MS = 20_000;

  const [navMode] = useState<NavMode>("walking");

  const PREVIEW_DISTANCE = navMode === "driving" ? 120 : 60;
  const FINAL_DISTANCE = navMode === "driving" ? 40 : 15;

  const [seniorSlowVoice, setSeniorSlowVoice] = useState(true);
  const { seniorMode, settings, effectiveSlow, effectiveStyle } = useSeniorMode();
  const lastSpeakRef = useRef<number>(0);
  const manualSpeakUntilRef = useRef<number>(0);

  // ===========================
  // INIT
  // ===========================
  useEffect(() => {
    (async () => {
      const slow = await loadSeniorSlowVoice();
      setSeniorSlowVoice(slow);
    })();

    if (routeData?.polyline) {
      const decoded = decodePolyline(routeData.polyline);
      setPolyCoords(decoded);

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(decoded, {
          edgePadding: { top: 80, bottom: 300, left: 60, right: 60 },
          animated: true,
        });
      }, 600);
    }

    if (routeData?.steps?.length) {
      setCurrentSteps(routeData.steps);
      // Speak the first step, landmark may arrive shortly after
      speakStep(0, undefined, { tapped: false });
    }

    startLocationWatch();
    return stopLocationWatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (seniorMode) setSeniorSlowVoice(true);
  }, [seniorMode]);

  useEffect(() => {
    announcedRef.current = false;
  }, [stepIndex]);

  // ===========================
  // LANDMARK FETCH (FIXED)
  // ===========================
  useEffect(() => {
    const step = steps[stepIndex];
    if (!step) {
      setCurrentLandmark(null);
      return;
    }

    const ll = getStepLatLng(step);
    if (!ll) {
      setCurrentLandmark(null);
      return;
    }

    const key = `${ll.lat.toFixed(5)},${ll.lng.toFixed(5)}`;

    // ✅ Prevent refetch spam if same coords
    if (lastLandmarkKeyRef.current === key) return;
    lastLandmarkKeyRef.current = key;

    setCurrentLandmark(null);

    getLandmarkName(ll.lat, ll.lng)
      .then((name) => setCurrentLandmark(name))
      .catch(() => setCurrentLandmark(null));
  }, [stepIndex, steps]);

  // ✅ When landmark arrives, re-speak current step ONCE with landmark prefix
  // const landmarkSpokenRef = useRef<string | null>(null);
  // useEffect(() => {
  //   if (!currentLandmark) return;

  //   const mark = `${stepIndex}:${currentLandmark}`;
  //   if (landmarkSpokenRef.current === mark) return;
  //   landmarkSpokenRef.current = mark;

  //   // re-speak current step but make it "fast feeling"
  //   speakStep(stepIndex, undefined, { tapped: true, forceLandmark: true });
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [currentLandmark]);

  // ===========================
  // LOCATION
  // ===========================
  async function startLocationWatch() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Location is needed.");
      return;
    }

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 3,
        timeInterval: 1000,
      },
      (pos) => {
        const newPos = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };

        setUserPos(newPos);
        updateEta(newPos, pos.coords.speed ?? 0);
        handleDistanceAnnouncements(newPos);
        detectOffRoute(newPos);
      }
    );
  }

  function stopLocationWatch() {
    watchRef.current?.remove();
    watchRef.current = null;
  }

  // ===========================
  // VOICE
  // ===========================
  function speakGuidance(text: string) {
    const now = Date.now();
    if (now - lastSpeakRef.current < 800) return; // ✅ prevent rapid double
    lastSpeakRef.current = now;

    speakLoud(text, {
      voice: settings.ttsVoice,
      style: effectiveStyle,
    });
  }

  function buildPrefix(opts?: { tapped?: boolean; forceLandmark?: boolean }) {
    // ✅ If landmark exists, prefer it always
    if (currentLandmark) return `Malapit sa ${currentLandmark}, `;

    // ✅ If user tapped Next, remove intro to feel faster
    if (opts?.tapped) return "";

    // ✅ Calm, not spammy
    return "Makinig, ";
  }

  function speakStep(
    index: number,
    distance?: number,
    opts?: { tapped?: boolean; forceLandmark?: boolean }
  ) {
    const step = steps[index];
    if (!step?.instruction) return;

    // announcedRef.current = false;

    const prefix = buildPrefix(opts);

    // `filipinoNavigator` can shorten / clean directions
    const spoken = filipinoNavigator(prefix + step.instruction, distance);
    speakGuidance(spoken);
  }

  // ===========================
  // DISTANCE ALERTS
  // ===========================
  function handleDistanceAnnouncements(pos: LatLng) {
     // ✅ don't auto-speak right after manual Next/Repeat
    if (Date.now() < manualSpeakUntilRef.current) return;
    const step = steps[stepIndex];
    if (!step || announcedRef.current) return;

    const target = getStepLatLng(step);
    if (!target) return;

    const d = haversine(pos.latitude, pos.longitude, target.lat, target.lng);

    // Preview prompt
    if (d < PREVIEW_DISTANCE && d > FINAL_DISTANCE) {
      const prefix = currentLandmark ? `Malapit sa ${currentLandmark}, ` : "";
      speakGuidance(`Sa ${Math.round(d)} metro, ${prefix}${step.instruction}`);
      announcedRef.current = true;
    }

    // Final prompt
    if (d < FINAL_DISTANCE) {
      speakStep(stepIndex);
      announcedRef.current = true;
    }
  }

  // ===========================
  // OFF ROUTE
  // ===========================
  function detectOffRoute(pos: LatLng) {
    if (polyCoords.length === 0) return;

    const nearest = polyCoords.reduce((min, p) => {
      const d = haversine(pos.latitude, pos.longitude, p.latitude, p.longitude);
      return d < min ? d : min;
    }, Infinity);

    const now = Date.now();

    if (
      nearest > 40 &&
      !offRouteRef.current &&
      now - lastRerouteRef.current > REROUTE_COOLDOWN_MS
    ) {
      offRouteRef.current = true;
      lastRerouteRef.current = now;

      // Keep your reroute logic if you have it; for now speak only
      speakGuidance("Sandali lang, inaayos ko ulit ang daan.");
    }

    if (nearest < 20) offRouteRef.current = false;
  }

  // ===========================
  // ETA
  // ===========================
  function updateEta(pos: LatLng, speed: number) {
    if (!destination) return;

    const dist = haversine(pos.latitude, pos.longitude, destination.lat, destination.lng);
    const effectiveSpeed = speed > 0.6 ? speed : 1.3;
    const mins = Math.max(1, Math.round(dist / effectiveSpeed / 60));
    setEta(`${mins} min`);
  }
  

  // ===========================
  // NEXT
  // ===========================
  function handleNext() {
    Vibration.vibrate(60);

    // ✅ block auto announcements for 2 seconds after tapping Next
    manualSpeakUntilRef.current = Date.now() + 2000;

    if (stepIndex < steps.length - 1) {
      const next = stepIndex + 1;
      setStepIndex(next);
      speakStep(next, undefined, { tapped: true });
    } else {
      speakStep(stepIndex, undefined, { tapped: true });
    }
  }

  const isLastStep = stepIndex >= steps.length - 1;
  const currentInstruction = steps[stepIndex]?.instruction ?? "Magpatuloy";

  // ===========================
  // CAMERA FOLLOW
  // ===========================
  useEffect(() => {
    if (userPos && mapRef.current) {
      mapRef.current.animateCamera({
        center: userPos,
        zoom: 17,
        pitch: 45,
      });
    }
  }, [userPos]);

  // ===========================
  // RENDER
  // ===========================
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation
        followsUserLocation
      >
        {polyCoords.length > 0 && (
          <Polyline coordinates={polyCoords} strokeWidth={6} strokeColor="#0A84FF" />
        )}

        {destination && (
          <Marker
            coordinate={{
              latitude: destination.lat,
              longitude: destination.lng,
            }}
          />
        )}
      </MapView>

      <LinearGradient
        colors={["rgba(234,242,255,0.95)", "transparent"]}
        style={styles.topFade}
      />

      <LinearGradient colors={["#FFFFFF", "#F4F8FF"]} style={styles.bottomCard}>
        {/* Landmark chip */}
        <View style={styles.landmarkChip}>
          <Ionicons name="location-outline" size={16} color="#0A84FF" />
          <Text style={styles.landmarkText}>
            {currentLandmark ? `Malapit sa ${currentLandmark}` : "Naghahanap ng landmark…"}
          </Text>
        </View>

        <View style={styles.iconCircle}>
          <Ionicons name="navigate" size={28} color="#0A84FF" />
        </View>

        <Text style={[styles.instruction, settings.bigText && { fontSize: 22 }]}>
          {currentInstruction}
        </Text>

        <Text style={styles.eta}>ETA: {eta}</Text>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Ionicons name={isLastStep ? "refresh" : "arrow-forward"} size={22} color="#FFF" />
          <Text style={styles.nextText}>{isLastStep ? "Repeat" : "Next"}</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

// ===========================
// UTILS
// ===========================
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ===========================
// STYLES
// ===========================
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  topFade: {
    position: "absolute",
    top: 0,
    height: 120,
    width: "100%",
  },

  bottomCard: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },

  landmarkChip: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6F0FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  landmarkText: {
    marginLeft: 6,
    color: "#0A84FF",
    fontWeight: "700",
  },

  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E6F0FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },

  instruction: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 8,
  },

  eta: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },

  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A84FF",
    paddingVertical: 14,
    borderRadius: 18,
  },

  nextText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },
});
