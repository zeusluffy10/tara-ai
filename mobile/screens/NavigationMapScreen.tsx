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
import { speakLoud, stopSpeakLoud } from "../utils/tts_loud";
import { filipinoNavigator } from "../utils/filipinoNavigator";
import { getLandmarkName } from "../utils/landmark";
import { loadSeniorSlowVoice } from "../utils/voiceStore";
import { useSeniorMode } from "../context/SeniorModeContext";

type Props = StackScreenProps<RootStackParamList, "NavigationMapScreen">;
type NavMode = "walking" | "driving";
const isDev = Boolean((globalThis as any).__DEV__);
let lastInitialPromptSignature = "";
let lastInitialPromptAt = 0;

function shouldSuppressInitialPrompt(signature: string): boolean {
  const now = Date.now();
  const isDuplicate =
    signature === lastInitialPromptSignature && now - lastInitialPromptAt < 4000;

  if (isDev && isDuplicate) {
    console.debug("[NavigationMapScreen] Suppressed duplicate initial prompt", {
      signature,
      elapsedMs: now - lastInitialPromptAt,
    });
  }

  if (!isDuplicate) {
    lastInitialPromptSignature = signature;
    lastInitialPromptAt = now;
  }

  return isDuplicate;
}

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

function getRouteDistanceMeters(routeData: any): number | null {
  const valueCandidates = [
    routeData?.distance?.value,
    routeData?.distance_value,
    routeData?.distanceValue,
    routeData?.routes?.[0]?.legs?.[0]?.distance?.value,
  ];

  for (const value of valueCandidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
  }

  const textCandidates = [
    routeData?.distance?.text,
    routeData?.distance_text,
    routeData?.distanceText,
    routeData?.routes?.[0]?.legs?.[0]?.distance?.text,
  ];

  for (const text of textCandidates) {
    if (typeof text !== "string") continue;
    const parsed = text.trim().toLowerCase().replace(/,/g, "");
    const match = parsed.match(/(\d+(?:\.\d+)?)\s*(km|kilometer|kilometers|m|meter|meters)\b/);
    if (!match) continue;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    return /km|kilometer/.test(match[2]) ? Math.round(amount * 1000) : Math.round(amount);
  }

  return null;
}

export default function NavigationMapScreen({ route, navigation }: Props) {
  const { routeData } = route.params;

  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const initSpeakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const currentLandmarkRef = useRef<string | null>(null);
  const lastLandmarkKeyRef = useRef<string | null>(null);

  function updateLandmark(name: string | null) {
    currentLandmarkRef.current = name;
    setCurrentLandmark(name);
  }

  const lastRerouteRef = useRef<number>(0);
  const REROUTE_COOLDOWN_MS = 20_000;

  const [navMode] = useState<NavMode>("walking");

  const PREVIEW_DISTANCE = navMode === "driving" ? 120 : 60;
  const FINAL_DISTANCE = navMode === "driving" ? 40 : 15;

  const [seniorSlowVoice, setSeniorSlowVoice] = useState(true);
  const { seniorMode, settings, effectiveSlow, effectiveStyle } = useSeniorMode();
  const lastSpeakRef = useRef<number>(0);
  const manualSpeakUntilRef = useRef<number>(0);
  const transportAdviceSpokenRef = useRef(false);

  const TRANSPORT_ADVICE_DISTANCE_M = 1200;
  const TRANSPORT_ADVICE_TEXT =
    "Medyo malayo ang pupuntahan mo. Mas mabilis kung sasakay ka ng jeep o tricycle.";
  const TRANSPORT_ADVICE_NO_SPOT_TEXT =
    "Wala akong nakitang malapit na sakayan ngayon, pero puwede kang magtanong sa pinakamalapit na kanto o terminal.";

  const transportSpots = Array.isArray(routeData?.transport_spots)
    ? routeData.transport_spots.slice(0, 3)
    : [];
  const nearestSpotName = transportSpots[0]?.name;

  const routeDistanceMeters = getRouteDistanceMeters(routeData);
  const shouldSpeakTransportAdvice =
    navMode === "walking" &&
    typeof routeDistanceMeters === "number" &&
    routeDistanceMeters >= TRANSPORT_ADVICE_DISTANCE_M;

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

      initSpeakTimeoutRef.current = setTimeout(() => {
        const firstInstruction = routeData.steps?.[0]?.instruction ?? "";
        const signature = `${routeData?.polyline ?? ""}|${firstInstruction}`;
        if (shouldSuppressInitialPrompt(signature)) return;

        manualSpeakUntilRef.current = Date.now() + 3500;
        speakStep(0, undefined, { tapped: false });
      }, 500);
    }

    startLocationWatch();
    return () => {
      if (initSpeakTimeoutRef.current) {
        clearTimeout(initSpeakTimeoutRef.current);
        initSpeakTimeoutRef.current = null;
      }
      stopLocationWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===========================
  // CLEANUP
  // ===========================
  useEffect(() => {
    return () => {
      stopSpeakLoud();
    };
  }, []);

  useEffect(() => {
    if (seniorMode) setSeniorSlowVoice(true);
  }, [seniorMode]);

  useEffect(() => {
    announcedRef.current = false;
  }, [stepIndex]);

  // ===========================
  // LANDMARK FETCH
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

    if (lastLandmarkKeyRef.current === key) return;
    lastLandmarkKeyRef.current = key;

    updateLandmark(null);

    getLandmarkName(ll.lat, ll.lng)
      .then((name) => updateLandmark(name))
      .catch(() => updateLandmark(null));
  }, [stepIndex, steps]);

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
    if (now - lastSpeakRef.current < 800) return;
    lastSpeakRef.current = now;

    speakLoud(text, {
      voice: settings.ttsVoice,
      gender: settings.ttsGender,
      style: effectiveStyle,
      emphasis: settings.ttsEmphasis,
      pauseMs: settings.ttsPauseMs,
    });
  }

  function buildPrefix(opts?: { tapped?: boolean; forceLandmark?: boolean }) {
    const landmark = currentLandmarkRef.current;
    if (landmark) return `Malapit sa ${landmark}, `;
    if (opts?.tapped) return "";
    return "";
  }

  async function speakStep(
    index: number,
    distance?: number,
    opts?: { tapped?: boolean; forceLandmark?: boolean }
  ) {
    const step = steps[index];
    if (!step?.instruction) return;

    let landmarkPrefix = buildPrefix(opts);

    const ll = getStepLatLng(step);

    if (!currentLandmarkRef.current && ll) {
      try {
        const name = await getLandmarkName(ll.lat, ll.lng);

        if (name) {
          landmarkPrefix = `Malapit sa ${name}, `;
          updateLandmark(name);
        }
      } catch {}
    }

    const spoken = filipinoNavigator(landmarkPrefix + step.instruction, distance);
    const isInitialStep = index === 0 && !opts?.tapped;

    if (isInitialStep && shouldSpeakTransportAdvice && !transportAdviceSpokenRef.current) {
      transportAdviceSpokenRef.current = true;
      const spotLine = nearestSpotName
        ? ` Pinakamalapit na sakayan: ${nearestSpotName}.`
        : ` ${TRANSPORT_ADVICE_NO_SPOT_TEXT}`;
      speakGuidance(`${TRANSPORT_ADVICE_TEXT}${spotLine} ${spoken}`);
      return;
    }

    speakGuidance(spoken);
  }

  // ===========================
  // DISTANCE ALERTS
  // ===========================
  function handleDistanceAnnouncements(pos: LatLng) {
    if (Date.now() < manualSpeakUntilRef.current) return;
    const step = steps[stepIndex];
    if (!step || announcedRef.current) return;

    const target = getStepLatLng(step);
    if (!target) return;

    const d = haversine(pos.latitude, pos.longitude, target.lat, target.lng);

    if (d < PREVIEW_DISTANCE && d > FINAL_DISTANCE) {
      const prefix = currentLandmarkRef.current ? `Malapit sa ${currentLandmarkRef.current}, ` : "";
      speakGuidance(filipinoNavigator(`${prefix}${step.instruction}`, Math.round(d)));
      announcedRef.current = true;
    }

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
  // BACK / NEXT
  // ===========================
  async function handleBack() {
    if (stepIndex <= 0) return;

    Vibration.vibrate(40);
    manualSpeakUntilRef.current = Date.now() + 2000;

    const previous = stepIndex - 1;
    currentLandmarkRef.current = null;
    setStepIndex(previous);

    setTimeout(() => {
      speakStep(previous, undefined, { tapped: true });
    }, 350);
  }

  async function handleNext() {
    Vibration.vibrate(60);

    manualSpeakUntilRef.current = Date.now() + 2000;

    if (stepIndex < steps.length - 1) {
      const next = stepIndex + 1;
      currentLandmarkRef.current = null;
      setStepIndex(next);

      setTimeout(() => {
        speakStep(next, undefined, { tapped: true });
      }, 500);
    } else {
      await stopSpeakLoud();
      navigation.navigate("SeniorModeHome");
    }
  }

  const canGoBack = stepIndex > 0;
  const isLastStep = stepIndex >= steps.length - 1;
  const currentInstruction = steps[stepIndex]?.instruction ?? "Magpatuloy";

  // ===========================
  // BLOCK 2 — Derived values + handleRepeatGuidance
  // ===========================
  const totalSteps = Math.max(1, steps.length);
  const currentStepNumber = Math.min(stepIndex + 1, totalSteps);
  const progress = currentStepNumber / totalSteps;

  const stepMode = getStepTravelMode(steps[stepIndex], navMode);
  const stepIcon = getStepIconName(stepMode);

  const trafficLevel = getTrafficLevel(routeData);
  const trafficColor =
    trafficLevel === "heavy"
      ? "#E5484D"
      : trafficLevel === "moderate"
      ? "#F5A524"
      : "#16A34A";
  const trafficLabel =
    trafficLevel === "heavy"
      ? "Heavy traffic"
      : trafficLevel === "moderate"
      ? "Moderate traffic"
      : "Light traffic";

  function handleRepeatGuidance() {
    Vibration.vibrate(20);
    manualSpeakUntilRef.current = Date.now() + 2000;
    speakStep(stepIndex, undefined, { tapped: true });
  }

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

        {/* Smart transport icon */}
        <View style={styles.iconCircle}>
          <Ionicons name={stepIcon} size={28} color="#0A84FF" />
        </View>

        {/* Current instruction */}
        <Text style={[styles.instruction, settings.bigText && { fontSize: 22 }]}>
          {currentInstruction}
        </Text>

        {/* Google Maps-style progress card */}
        <View style={styles.progressCard}>
          <Text style={[
            styles.progressTitle,
            currentStepNumber === totalSteps 
              ? { color: "#16A34A", fontWeight: "800" } 
              : { color: "#1C1C1E" }
          ]}>
            {currentStepNumber === totalSteps ? "You have arrived! 🎉" : "You are on your way"}
          </Text>

          <View style={styles.progressRow}>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressCounter}>
              {currentStepNumber} of {totalSteps}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name={stepIcon} size={14} color="#475569" />
              <Text style={styles.metaText}>{formatDistance(routeDistanceMeters)}</Text>
            </View>
            <Text style={styles.metaDot}>·</Text>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#475569" />
              <Text style={styles.metaText}>ETA {eta}</Text>
            </View>
            <Text style={styles.metaDot}>·</Text>
            <View style={styles.metaItem}>
              <View style={[styles.trafficDot, { backgroundColor: trafficColor }]} />
              <Text style={[styles.metaText, { color: trafficColor, marginLeft: 6 }]}>
                {trafficLabel}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.repeatBtn}
            onPress={handleRepeatGuidance}
            accessibilityRole="button"
            accessibilityLabel="Tap to hear guidance again"
          >
            <View style={styles.repeatIconCircle}>
              <Ionicons name="volume-high" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.repeatText}>Tap to hear guidance again</Text>
          </TouchableOpacity>
        </View>

        {/* Sakayan spots */}
        {shouldSpeakTransportAdvice && transportSpots.length > 0 && (
          <View style={styles.sakayanListCard}>
            <Text style={styles.sakayanTitle}>Nearby Sakayan Spots</Text>
            {transportSpots.map((spot: any, index: number) => (
              <View key={`${spot.place_id ?? spot.name}-${index}`} style={styles.sakayanRow}>
                <View style={[styles.sakayanIconBadge, getSakayanIconBadgeStyle(spot.kind)]}>
                  <Ionicons name={getSakayanIconName(spot.kind)} size={13} color={getSakayanIconColor(spot.kind)} />
                </View>
                <Text style={styles.sakayanItem}>{index + 1}. {spot.name}</Text>
              </View>
            ))}
          </View>
        )}

        {shouldSpeakTransportAdvice && transportSpots.length === 0 && (
          <View style={styles.sakayanListCard}>
            <Text style={styles.sakayanTitle}>Nearby Sakayan Spots</Text>
            <Text style={styles.sakayanEmptyText}>No nearby jeep/trike/bus spot found yet.</Text>
          </View>
        )}

        {/* Nav buttons */}
        <View style={styles.navButtonsRow}>
          <TouchableOpacity
            style={[styles.backBtn, !canGoBack && styles.backBtnDisabled]}
            onPress={handleBack}
            disabled={!canGoBack}
          >
            <Ionicons name="arrow-back" size={20} color={canGoBack ? "#0A63CC" : "#94A3B8"} />
            <Text style={[styles.backText, !canGoBack && styles.backTextDisabled]}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Ionicons name={isLastStep ? "home" : "arrow-forward"} size={22} color="#FFF" />
            <Text style={styles.nextText}>{isLastStep ? "Home" : "Next"}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

// ===========================
// BLOCK 1 — Helper functions
// ===========================
function formatDistance(meters: number | null): string {
  if (typeof meters !== "number" || meters <= 0) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
  return `${meters} m`;
}

function getStepTravelMode(step: any, fallback: NavMode): NavMode {
  const raw = String(step?.travel_mode ?? step?.travelMode ?? "").toLowerCase();
  if (raw.includes("walk")) return "walking";
  if (raw.includes("driv") || raw.includes("car")) return "driving";
  return fallback;
}

function getStepIconName(mode: NavMode): "walk" | "car-sport" {
  return mode === "driving" ? "car-sport" : "walk";
}

type TrafficLevel = "light" | "moderate" | "heavy";
function getTrafficLevel(routeData: any): TrafficLevel {
  const normal =
    routeData?.routes?.[0]?.legs?.[0]?.duration?.value ??
    routeData?.duration?.value;
  const traffic =
    routeData?.routes?.[0]?.legs?.[0]?.duration_in_traffic?.value ??
    routeData?.duration_in_traffic?.value;
  if (typeof normal === "number" && typeof traffic === "number" && normal > 0) {
    const ratio = traffic / normal;
    if (ratio >= 1.4) return "heavy";
    if (ratio >= 1.15) return "moderate";
  }
  return "light";
}

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

function getSakayanIconName(kind?: string): "car-sport" | "bicycle" | "bus" {
  if (kind === "trike") return "bicycle";
  if (kind === "bus") return "bus";
  return "car-sport";
}

function getSakayanIconColor(kind?: string): string {
  if (kind === "trike") return "#0A8F55";
  if (kind === "bus") return "#0A63CC";
  return "#B87500";
}

function getSakayanIconBadgeStyle(kind?: string) {
  if (kind === "trike") return { backgroundColor: "#D8F5E5" };
  if (kind === "bus") return { backgroundColor: "#DCEBFF" };
  return { backgroundColor: "#FFE8B3" };
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

  // BLOCK 4 — New styles
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    marginRight: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#0A84FF",
    borderRadius: 3,
  },
  progressCounter: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A84FF",
    minWidth: 56,
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    marginLeft: 4,
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  metaDot: {
    marginHorizontal: 6,
    color: "#94A3B8",
    fontWeight: "700",
  },
  trafficDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  repeatBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#EAF2FF",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  repeatIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  repeatText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A63CC",
  },

  sakayanListCard: {
    backgroundColor: "#F4F8FF",
    borderWidth: 1,
    borderColor: "#DCEBFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },

  sakayanTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A63CC",
    marginBottom: 4,
  },

  sakayanRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  sakayanIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },

  sakayanItem: {
    fontSize: 13,
    color: "#1F2937",
  },

  sakayanEmptyText: {
    fontSize: 13,
    color: "#6B7280",
  },

  navButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  backBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F1FF",
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#BBD8FF",
  },

  backBtnDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },

  backText: {
    marginLeft: 6,
    fontSize: 17,
    fontWeight: "700",
    color: "#0A63CC",
  },

  backTextDisabled: {
    color: "#94A3B8",
  },

  nextBtn: {
    flex: 1,
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
