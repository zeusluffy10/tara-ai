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

  const destination = routeData?.destination;
  const [currentLandmark, setCurrentLandmark] =
    useState<string | null>(null);
  const [currentSteps, setCurrentSteps] = useState<any[]>(
    routeData?.steps ?? []
  );

  const [currentPolyline, setCurrentPolyline] = useState<LatLng[]>([]);
  const steps = currentSteps;
  const lastRerouteRef = useRef<number>(0);
  const REROUTE_COOLDOWN_MS = 20_000; // 20 seconds

  // ===========================
  // INIT
  // ===========================
  useEffect(() => {
    if (routeData?.polyline) {
      const decoded = decodePolyline(routeData.polyline);

      // 🔹 initialize BOTH polylines
      setPolyCoords(decoded);
      setCurrentPolyline(decoded);

      // Fit map to route
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(decoded, {
          edgePadding: { top: 80, bottom: 280, left: 60, right: 60 },
          animated: true,
        });
      }, 600);
    }

    // 🔹 initialize steps state
    if (routeData?.steps?.length) {
      setCurrentSteps(routeData.steps);
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

  async function rerouteFromPosition(pos: LatLng) {
    if (!destination) return;

    try {
      speakLoud("Sandali lang, inaayos ko ulit ang daan.");

      const res = await fetch(
        `https://tara-ai-backend-swbp.onrender.com/reroute?origin_lat=${pos.latitude}&origin_lng=${pos.longitude}&dest_lat=${destination.lat}&dest_lng=${destination.lng}`
      );

      const data = await res.json();

      if (!data?.routes?.length) {
        speakLoud("Pasensya na, hindi ako makahanap ng bagong daan.");
        return;
      }

      const route = data.routes[0];

      const newPolyline = decodePolyline(
        route.overview_polyline.points
      );

      setPolyCoords(newPolyline);
      setCurrentPolyline(newPolyline);

      const newSteps = route.legs[0].steps.map((s: any) => ({
        instruction: s.html_instructions.replace(/<[^>]+>/g, ""),
        maneuver: s.maneuver,
        lat: s.end_location.lat,
        lng: s.end_location.lng,
      }));

      setCurrentSteps(newSteps);
      setStepIndex(0);

      speakLoud("Okay na. Sundan mo ulit ang bagong direksyon.");

      // Fit map to new route
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(newPolyline, {
          edgePadding: { top: 80, bottom: 280, left: 60, right: 60 },
          animated: true,
        });
      }, 600);
    } catch (e) {
      speakLoud("May problema sa pagkuha ng bagong daan.");
    }
  }


  function stopLocationWatch() {
    watchRef.current?.remove();
    watchRef.current = null;
  }

  function getFallbackPrefix() {
    const phrases = [
      "Sa susunod na kanto, ",
      "Bandang unahan, ",
      "Pagdating sa kanto, ",
      "Malapit na sa kanto, ",
    ];

    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  // ===========================
  // VOICE
  // ===========================
  function speakStep(index: number, distance?: number) {
    const step = steps[index];
    if (!step?.instruction) return;

    announcedRef.current = false;

    const prefix = currentLandmark
      ? `Pag lampas ng ${currentLandmark}, `
      : getFallbackPrefix();

    const spoken = filipinoNavigator(
      prefix + step.instruction,
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

    const now = Date.now();

    if (
      nearest > 40 &&
      !offRouteRef.current &&
      now - lastRerouteRef.current > REROUTE_COOLDOWN_MS
    ) {
      offRouteRef.current = true;
      lastRerouteRef.current = now;
      rerouteFromPosition(pos);
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
        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: "#FF3B30", marginTop: 8 }
          ]}
          onPress={() => {
            if (!userPos) return;
            rerouteFromPosition(userPos);
          }}
        >
          <Text style={styles.btnText}>Force Reroute</Text>
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
