import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Vibration,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  LatLng,
  PROVIDER_GOOGLE,
} from "react-native-maps";
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

type Props = StackScreenProps<
  RootStackParamList,
  "NavigationMapScreen"
>;

type NavMode = "walking" | "driving";

export default function NavigationMapScreen({ route }: Props) {
  /* ===========================
     STATE & LOGIC (UNCHANGED)
  =========================== */

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
  const [currentLandmark, setCurrentLandmark] = useState<string | null>(null);
  const [currentSteps, setCurrentSteps] = useState<any[]>(
    routeData?.steps ?? []
  );

  const steps = currentSteps;
  const lastRerouteRef = useRef<number>(0);
  const REROUTE_COOLDOWN_MS = 20_000;
  const [navMode] = useState<NavMode>("walking");

  const PREVIEW_DISTANCE = navMode === "driving" ? 120 : 60;
  const FINAL_DISTANCE = navMode === "driving" ? 40 : 15;

  const [seniorSlowVoice, setSeniorSlowVoice] = useState(true);
  const { seniorMode, settings, effectiveSlow, effectiveStyle } = useSeniorMode();

  /* ===========================
     INIT (UNCHANGED)
  =========================== */

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
      speakStep(0);
    }

    startLocationWatch();
    return stopLocationWatch;
  }, []);

  useEffect(() => {
    if (seniorMode) setSeniorSlowVoice(true);
  }, [seniorMode]);

  useEffect(() => {
    const step = steps[stepIndex];
    if (!step?.lat || !step?.lng) return;

    setCurrentLandmark(null);
    getLandmarkName(step.lat, step.lng)
      .then(setCurrentLandmark)
      .catch(() => setCurrentLandmark(null));
  }, [stepIndex]);

  /* ===========================
     LOCATION & NAV LOGIC
     (UNCHANGED)
  =========================== */

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

  function speakGuidance(text: string) {
    speakLoud(text, {
      slow: effectiveSlow,
      voice: settings.ttsVoice,
      style: effectiveStyle,
    });
  }

  function speakStep(index: number, distance?: number) {
    const step = steps[index];
    if (!step?.instruction) return;

    announcedRef.current = false;

    const prefix = currentLandmark
      ? `Pag lampas ng ${currentLandmark}, `
      : "Sa susunod, ";

    const spoken = filipinoNavigator(prefix + step.instruction, distance);
    speakGuidance(spoken);
  }

  function handleDistanceAnnouncements(pos: LatLng) {
    const step = steps[stepIndex];
    if (!step?.end_location || announcedRef.current) return;

    const d = haversine(
      pos.latitude,
      pos.longitude,
      step.end_location.lat,
      step.end_location.lng
    );

    if (d < PREVIEW_DISTANCE && d > FINAL_DISTANCE) {
      speakGuidance(`Sa ${Math.round(d)} metro, ${step.instruction}`);
      announcedRef.current = true;
    }

    if (d < FINAL_DISTANCE) {
      speakStep(stepIndex);
      announcedRef.current = true;
    }
  }

  function detectOffRoute(pos: LatLng) {
    if (polyCoords.length === 0) return;

    const nearest = polyCoords.reduce((min, p) => {
      const d = haversine(
        pos.latitude,
        pos.longitude,
        p.latitude,
        p.longitude
      );
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
      speakGuidance("Sandali lang, inaayos ko ulit ang daan.");
    }

    if (nearest < 20) offRouteRef.current = false;
  }

  function updateEta(pos: LatLng, speed: number) {
    if (!destination) return;

    const dist = haversine(
      pos.latitude,
      pos.longitude,
      destination.lat,
      destination.lng
    );

    const effectiveSpeed = speed > 0.6 ? speed : 1.3;
    const mins = Math.max(1, Math.round(dist / effectiveSpeed / 60));
    setEta(`${mins} min`);
  }

  function handleNext() {
    Vibration.vibrate(80);
    if (stepIndex < steps.length - 1) {
      const next = stepIndex + 1;
      setStepIndex(next);
      speakStep(next);
    } else {
      speakStep(stepIndex);
    }
  }

  const isLastStep = stepIndex >= steps.length - 1;
  const currentInstruction =
    steps[stepIndex]?.instruction ?? "Magpatuloy";

  /* ===========================
     RENDER (NEW UI)
  =========================== */

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
          <Polyline
            coordinates={polyCoords}
            strokeWidth={6}
            strokeColor="#0A84FF"
          />
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

      {/* TOP FADE */}
      <LinearGradient
        colors={["rgba(234,242,255,0.95)", "transparent"]}
        style={styles.topFade}
      />

      {/* BOTTOM CARD */}
      <LinearGradient
        colors={["#FFFFFF", "#F4F8FF"]}
        style={styles.bottomCard}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="arrow-up" size={28} color="#0A84FF" />
        </View>

        <Text
          style={[
            styles.instruction,
            settings.bigText && { fontSize: 22 },
          ]}
        >
          {currentInstruction}
        </Text>

        <Text style={styles.eta}>ETA: {eta}</Text>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Ionicons
            name={isLastStep ? "refresh" : "arrow-forward"}
            size={22}
            color="#FFF"
          />
          <Text style={styles.nextText}>
            {isLastStep ? "Repeat" : "Next"}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

/* ===========================
   UTILS (UNCHANGED)
=========================== */

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
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

/* ===========================
   STYLES (NEW)
=========================== */

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
