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
import MapView, {
  Marker,
  Polyline,
  LatLng,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import * as Location from "expo-location";
import { StackScreenProps } from "@react-navigation/stack";

import decodePolyline from "../utils/polylineDecode";
import { RootStackParamList } from "../types/navigation";
import { speakLoud } from "../utils/tts_loud";
import { filipinoNavigator } from "../utils/filipinoNavigator";

type Props = StackScreenProps<
  RootStackParamList,
  "NavigationMapScreen"
>;

export default function NavigationMapScreen({ route }: Props) {
  const { routeData } = route.params;

  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const [polyCoords, setPolyCoords] = useState<LatLng[]>([]);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [eta, setEta] = useState("1 min");

  const steps = routeData?.steps ?? [];
  const destination = routeData?.destination;

  // ===========================
  // INIT
  // ===========================
  useEffect(() => {
    if (routeData?.polyline) {
      const decoded = decodePolyline(routeData.polyline);
      setPolyCoords(decoded);

      // Fit map to route
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(decoded, {
          edgePadding: { top: 80, bottom: 260, left: 60, right: 60 },
          animated: true,
        });
      }, 600);
    }

    // Speak FIRST instruction
    if (steps.length > 0) {
      speakStep(0);
    }

    startLocationWatch();
    return stopLocationWatch;
  }, []);

  // ===========================
  // LOCATION
  // ===========================
  async function startLocationWatch() {
    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission required", "Location permission needed.");
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
  function speakStep(index: number, distance?: number) {
    const step = steps[index];
    if (!step?.instruction) return;

    const polished = filipinoNavigator(
      step.instruction,
      distance
    );

    speakLoud(polished);
  }

  // ===========================
  // NEXT / REPEAT
  // ===========================
  function handleNext() {
    Vibration.vibrate(80);

    if (stepIndex < steps.length - 1) {
      const next = stepIndex + 1;
      setStepIndex(next);
      speakStep(next);
    } else {
      // Repeat last instruction
      speakStep(stepIndex);
    }
  }

  const isLastStep = stepIndex >= steps.length - 1;
  const currentInstruction =
    steps[stepIndex]?.instruction ?? "Magpatuloy";

  // ===========================
  // ETA (ALWAYS SHOWS)
  // ===========================
  function updateEta(pos: LatLng, speed: number) {
    if (!destination) return;

    const dist = haversine(
      pos.latitude,
      pos.longitude,
      destination.lat,
      destination.lng
    );

    const effectiveSpeed = speed > 0.6 ? speed : 1.3; // walking fallback
    const mins = Math.max(1, Math.round(dist / effectiveSpeed / 60));

    setEta(`${mins} min`);
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
  // UI
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
          <Polyline
            coordinates={polyCoords}
            strokeWidth={6}
            strokeColor="#007AFF"
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

      <View style={styles.bottomCard}>
        <Text style={styles.label}>Susunod:</Text>
        <Text style={styles.instruction}>
          {currentInstruction}
        </Text>
        <Text style={styles.eta}>ETA: {eta}</Text>

        <TouchableOpacity
          style={styles.btn}
          onPress={handleNext}
        >
          <Text style={styles.btnText}>
            {isLastStep ? "Repeat" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===========================
// UTILS
// ===========================
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

// ===========================
// STYLES
// ===========================
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  bottomCard: {
    position: "absolute",
    bottom: 18,
    left: 14,
    right: 14,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    elevation: 4,
  },
  label: { fontWeight: "800", marginBottom: 6 },
  instruction: { fontSize: 16, marginBottom: 6 },
  eta: { color: "#555", marginBottom: 10 },

  btn: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
