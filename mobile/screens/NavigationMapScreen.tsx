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
import { getLandmarkName } from "../utils/landmark";

type Props = StackScreenProps<
  RootStackParamList,
  "NavigationMapScreen"
>;

export default function NavigationMapScreen({ route }: Props) {
  const { routeData } = route.params;

  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const announcedRef = useRef<boolean>(false);
  const offRouteRef = useRef<boolean>(false);

  const [polyCoords, setPolyCoords] = useState<LatLng[]>([]);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [eta, setEta] = useState("1 min");

  const steps = routeData?.steps ?? [];
  const destination = routeData?.destination;
  const [currentLandmark, setCurrentLandmark] =
    useState<string | null>(null);

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
          edgePadding: { top: 80, bottom: 280, left: 60, right: 60 },
          animated: true,
        });
      }, 600);
    }

    // Speak first instruction
    if (steps.length > 0) {
      speakStep(0);
    }

    startLocationWatch();
    return stopLocationWatch;
  }, []);

  useEffect(() => {
    const step = steps[stepIndex];

    console.warn("STEP DEBUG:", step);

    if (!step?.lat || !step?.lng) {
      console.warn("NO STEP COORDS");
      return;
    }

    setCurrentLandmark(null);

    getLandmarkName(step.lat, step.lng)
      .then((name) => {
        console.warn("LANDMARK FOUND:", name);
        setCurrentLandmark(name);
      })
      .catch((err) => {
        console.warn("LANDMARK ERROR:", err.message);
        setCurrentLandmark(null);
      });
  }, [stepIndex]);


  // ===========================
  // LOCATION
  // ===========================
  async function startLocationWatch() {
    const { status } =
      await Location.requestForegroundPermissionsAsync();

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
  function speakStep(index: number, distance?: number) {
    const step = steps[index];
    if (!step?.instruction) return;

    announcedRef.current = false;

    const landmarkPrefix = currentLandmark
      ? `Pag lampas ng ${currentLandmark}, `
      : "";

    const spoken = filipinoNavigator(
      landmarkPrefix + step.instruction,
      distance
    );

    speakLoud(spoken);
  }


  // ===========================
  // DISTANCE ALERTS
  // ===========================
  function handleDistanceAnnouncements(pos: LatLng) {
    const step = steps[stepIndex];
    if (!step?.end_location || announcedRef.current) return;

    const d = haversine(
      pos.latitude,
      pos.longitude,
      step.end_location.lat,
      step.end_location.lng
    );

    if (d < 60 && d > 25) {
      const preview = filipinoNavigator(step.instruction, d);
      const landmarkPrefix = currentLandmark
        ? `Pag lampas ng ${currentLandmark}, `
        : "";

      speakLoud(
        `Sa ${Math.round(d)} metro, ${landmarkPrefix}${preview}`
      );
      announcedRef.current = true;
    }

    if (d < 15) {
      speakStep(stepIndex);
      announcedRef.current = true;
    }
  }

  // ===========================
  // OFF-ROUTE DETECTION
  // ===========================
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

    if (nearest > 40 && !offRouteRef.current) {
      speakLoud("Mukhang naligaw ka. Sandali lang.");
      offRouteRef.current = true;
    }

    if (nearest < 20) {
      offRouteRef.current = false;
    }
  }

  // ===========================
  // ETA
  // ===========================
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
      speakStep(stepIndex);
    }
  }

  // ===========================
  // UI HELPERS
  // ===========================
  function getTurnArrow(maneuver?: string) {
    if (!maneuver) return "⬆️";
    if (maneuver.includes("left")) return "⬅️";
    if (maneuver.includes("right")) return "➡️";
    if (maneuver.includes("uturn")) return "⤴️";
    return "⬆️";
  }

  const isLastStep = stepIndex >= steps.length - 1;
  const currentInstruction =
    steps[stepIndex]?.instruction ?? "Magpatuloy";

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
        <Text style={styles.arrow}>
          {getTurnArrow(steps[stepIndex]?.maneuver)}
        </Text>

        <Text style={styles.label}>Susunod:</Text>
        <Text style={styles.instruction}>{currentInstruction}</Text>
        <Text style={styles.eta}>ETA: {eta}</Text>

        <TouchableOpacity style={styles.btn} onPress={handleNext}>
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

  arrow: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 6,
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
