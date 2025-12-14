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
import * as Location from "expo-location";
import decodePolyline from "../utils/polylineDecode";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { useSeniorMode } from "../context/SeniorModeContext";
import { speakLoud } from "../utils/tts_loud";
import { toTaglish } from "../utils/taglish";

type Props = StackScreenProps<RootStackParamList, "NavigationMapScreen">;

export default function NavigationMapScreen({ route, navigation }: Props) {
  const { routeData } = route.params;
  const { settings } = useSeniorMode();

  const [polyCoords, setPolyCoords] = useState<LatLng[]>([]);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [predictedEta, setPredictedEta] = useState("--");
  const [arrived, setArrived] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const lastSpokenStepRef = useRef<number>(-1);
  const lastSpokenAtRef = useRef<number>(0);
  const nearAlertRef = useRef<boolean>(false);

  // ---------------------------
  // INIT
  // ---------------------------
  useEffect(() => {
    if (routeData?.polyline) {
      setPolyCoords(decodePolyline(routeData.polyline));
    }

    if (routeData?.steps?.length) {
      speakStep(routeData.steps[0].instruction);
    }

    startLocationWatch();
    return stopLocationWatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // TAGLISH SPEAK
  // ---------------------------
  function speakStep(stepText: string, distance?: number) {
    const taglish = toTaglish(stepText, distance);
    speakLoud(taglish);
    lastSpokenAtRef.current = Date.now();
  }

  // ---------------------------
  // LOCATION WATCH
  // ---------------------------
  async function startLocationWatch() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Location permission is required.");
      return;
    }

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 2,
        timeInterval: 1000,
      },
      (pos) => {
        handlePositionUpdate(
          { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          pos.coords.speed ?? 0
        );
      }
    );
  }

  function stopLocationWatch() {
    watchRef.current?.remove();
    watchRef.current = null;
  }

  // ---------------------------
  // CORE NAVIGATION LOGIC
  // ---------------------------
  function handlePositionUpdate(newPos: LatLng, speed: number) {
    setUserPos(newPos);

    const steps = routeData?.steps ?? [];
    if (!steps.length) return;

    // 🔁 find nearest step
    let nearestIndex = currentStepIndex;
    let nearestDist = Number.MAX_VALUE;

    steps.forEach((s: any, i: number) => {
      const loc = s.start_location || s.end_location;
      if (!loc) return;

      const d = haversineDistance(
        newPos.latitude,
        newPos.longitude,
        loc.lat,
        loc.lng
      );

      if (d < nearestDist) {
        nearestDist = d;
        nearestIndex = i;
      }
    });

    // 🔊 step change
    if (
      nearestIndex !== currentStepIndex &&
      nearestDist < 45 // meters
    ) {
      setCurrentStepIndex(nearestIndex);
      Vibration.vibrate(150);

      const step = steps[nearestIndex];
      if (step?.instruction) {
        speakStep(step.instruction, nearestDist);
        lastSpokenStepRef.current = nearestIndex;
      }
    }

    // 🔁 auto-repeat if stopped
    if (
      settings.autoRepeat &&
      speed < 0.4 &&
      Date.now() - lastSpokenAtRef.current >
        settings.repeatDelaySec * 1000
    ) {
      const step = steps[currentStepIndex];
      if (step?.instruction) {
        speakLoud(`Uulitin ko. ${toTaglish(step.instruction)}`);
        lastSpokenAtRef.current = Date.now();
      }
    }

    // 📍 destination logic
    const dest = routeData?.destination;
    if (dest) {
      const dToDest = haversineDistance(
        newPos.latitude,
        newPos.longitude,
        dest.lat,
        dest.lng
      );

      if (!nearAlertRef.current && dToDest < 35) {
        speakLoud("Malapit ka na. Konting lakad na lang.");
        nearAlertRef.current = true;
      }

      if (!arrived && dToDest < 12) {
        setArrived(true);
        speakLoud("Nakarating ka na sa destinasyon. Salamat!");
        stopLocationWatch();
        return;
      }
    }

    computeEta(newPos, speed);
  }

  // ---------------------------
  // ETA
  // ---------------------------
  function computeEta(pos: LatLng, speed: number) {
    if (!routeData?.destination || speed <= 0) return;

    const dist = haversineDistance(
      pos.latitude,
      pos.longitude,
      routeData.destination.lat,
      routeData.destination.lng
    );

    const mins = Math.max(1, Math.round(dist / speed / 60));
    setPredictedEta(`${mins} min`);
  }

  // ---------------------------
  // UI
  // ---------------------------
  const nextInstruction =
    routeData?.steps?.[currentStepIndex]?.instruction ??
    "Magpatuloy lamang";

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
      >
        {polyCoords.length > 0 && (
          <Polyline coordinates={polyCoords} strokeWidth={5} strokeColor="#007AFF" />
        )}

        {routeData?.destination && (
          <Marker
            coordinate={{
              latitude: routeData.destination.lat,
              longitude: routeData.destination.lng,
            }}
            title="Destination"
          />
        )}
      </MapView>

      <View style={styles.bottomCard}>
        <Text style={styles.nextLabel}>Susunod:</Text>
        <Text style={styles.instructionText}>{nextInstruction}</Text>
        <Text style={styles.etaText}>ETA: {predictedEta}</Text>

        <TouchableOpacity
          style={styles.repeatBtn}
          onPress={() => speakStep(nextInstruction)}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Repeat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------
// UTILS
// ---------------------------
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  bottomCard: {
    position: "absolute",
    bottom: 20,
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
  },
  nextLabel: { fontWeight: "800", marginBottom: 6 },
  instructionText: { fontSize: 16 },
  etaText: { marginTop: 6, color: "#555" },
  repeatBtn: {
    marginTop: 10,
    backgroundColor: "#007AFF",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
});
