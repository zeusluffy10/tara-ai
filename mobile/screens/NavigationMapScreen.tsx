// mobile/screens/NavigationMapScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Vibration,
  Platform,
} from "react-native";
import MapView, { Marker, Polyline, LatLng, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import decodePolyline from "../utils/polylineDecode";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { useSeniorMode } from "../context/SeniorModeContext";

type Props = StackScreenProps<RootStackParamList, "NavigationMapScreen">;

export default function NavigationMapScreen({ route, navigation }: Props) {
  const { routeData } = route.params;
  const { settings } = useSeniorMode();

  // polyline coords for drawing
  const [polyCoords, setPolyCoords] = useState<LatLng[]>([]);
  // user position
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  // index of current step
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  // predicted ETA string
  const [predictedEta, setPredictedEta] = useState<string>("--");
  // whether arrived
  const [arrived, setArrived] = useState<boolean>(false);

  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<any>(null);
  const lastPosRef = useRef<{ pos: LatLng; time: number } | null>(null);
  const repeatCooldownRef = useRef<number>(0);

  useEffect(() => {
    // decode polyline if present
    if (routeData?.polyline) {
      const pts = decodePolyline(routeData.polyline);
      setPolyCoords(pts);
    }

    // if steps exist but have no lat/lng, optionally compute fallback later
    // start location watching
    startLocationWatch();

    return () => stopLocationWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startLocationWatch() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Location permission is required for navigation.");
        return;
      }

      const initial = await Location.getCurrentPositionAsync({});
      setUserPos({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, distanceInterval: 2, timeInterval: 1000 },
        (pos) => {
          const newPos = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          handlePositionUpdate(newPos, pos.coords.speed ?? null);
        }
      );
    } catch (err) {
      console.warn("Location watch failed:", err);
    }
  }

  function stopLocationWatch() {
    try {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    } catch {}
  }

  // handle an incoming new position (either from watchPosition or initial)
  function handlePositionUpdate(newPos: LatLng, rawSpeed: number | null) {
    setUserPos(newPos);

    // update nearest step
    updateNearestStep(newPos);

    // check arrival
    const dest = routeData?.destination;
    if (dest && typeof dest.lat === "number" && typeof dest.lng === "number") {
      const dToDest = haversineDistance(newPos.latitude, newPos.longitude, dest.lat, dest.lng);
      if (!arrived && dToDest < 12) {
        setArrived(true);
        Speech.speak("Nakarating ka na sa destinasyon. Salamat!", { rate: settings.slowTts ? 0.8 : 1 });
        stopLocationWatch();
      }
    }

    // ETA prediction using recent movement
    computeEta(newPos, rawSpeed);
  }

  // Compute ETA: estimate speed from device speed or derived from last position
  function computeEta(current: LatLng, rawSpeed: number | null) {
    const now = Date.now();
    let speed = rawSpeed ?? 0; // meters per second if available

    // fallback: compute approximate speed from lastPosRef
    if ((!speed || speed === 0) && lastPosRef.current) {
      const last = lastPosRef.current;
      const dt = (now - last.time) / 1000;
      if (dt > 0) {
        const traveled = haversineDistance(last.pos.latitude, last.pos.longitude, current.latitude, current.longitude);
        speed = traveled / Math.max(dt, 1);
      }
    }

    // update last pos
    lastPosRef.current = { pos: current, time: now };

    if (!speed || speed <= 0.05) {
      // if standing still, don't change ETA aggressively; leave previous ETA
      return;
    }

    // remaining distance to destination
    const dest = routeData?.destination;
    if (!dest) return;
    const remainMeters = haversineDistance(current.latitude, current.longitude, dest.lat, dest.lng);

    const etaSec = remainMeters / speed;
    if (!isFinite(etaSec) || etaSec <= 0) return;

    if (etaSec > 3600 * 5) {
      // too long, set placeholder
      setPredictedEta("> 3 hr");
    } else {
      const mins = Math.max(1, Math.round(etaSec / 60));
      setPredictedEta(`${mins} min`);
    }
  }

  // update current step index using nearest step heuristic
  function updateNearestStep(user: LatLng) {
    if (!routeData?.steps || routeData.steps.length === 0) return;

    let nearest = 0;
    let best = Number.MAX_VALUE;

    routeData.steps.forEach((s: any, i: number) => {
      if (typeof s.lat === "number" && typeof s.lng === "number") {
        const d = haversineDistance(user.latitude, user.longitude, s.lat, s.lng);
        if (d < best) {
          best = d;
          nearest = i;
        }
      } else if (polyCoords && polyCoords.length > 0) {
        // fallback: compute distance to closest poly point segment (cheap: to poly point)
        for (let p of polyCoords) {
          const d = haversineDistance(user.latitude, user.longitude, p.latitude, p.longitude);
          if (d < best) {
            best = d;
            nearest = i;
          }
        }
      }
    });

    // threshold for switching step (30 meters)
    if (nearest !== currentStepIndex && best < 30) {
      setCurrentStepIndex(nearest);
      // vibrate and speak the new instruction
      try {
        Vibration.vibrate(180);
      } catch {}
      const newStep = routeData.steps[nearest];
      if (newStep && newStep.instruction) {
        Speech.speak(newStep.instruction, { rate: settings.slowTts ? 0.85 : 1 });
      }
    }
  }

  // manual repeat button
  function repeatInstruction() {
    const step = routeData?.steps?.[currentStepIndex];
    if (!step) return;
    Speech.speak(step.instruction, { rate: settings.slowTts ? 0.85 : 1 });
  }

  // auto-repeat when stopped (called in watch callback via handlePositionUpdate)
  useEffect(() => {
    if (!settings.autoRepeat) return;

    // We will rely on lastPosRef and repeatCooldownRef within computeEta & handlePositionUpdate
    // But implement a light-weight interval to check stopped state if needed
    const interval = setInterval(async () => {
      // if no user pos, skip
      if (!userPos) return;

      // determine recent speed (rough)
      let recentSpeed = 0;
      // if platform provides speed in last location, compute from lastPosRef
      if (lastPosRef.current) {
        const last = lastPosRef.current;
        const dt = (Date.now() - last.time) / 1000;
        if (dt > 0) {
          const d = haversineDistance(last.pos.latitude, last.pos.longitude, userPos.latitude, userPos.longitude);
          recentSpeed = d / Math.max(dt, 1);
        }
      }

      // if effectively stopped (<0.4 m/s), and autoRepeat enabled, repeat instruction after configured delay
      if (recentSpeed < 0.4) {
        const now = Date.now();
        if (now - (repeatCooldownRef.current ?? 0) > (settings.repeatDelaySec * 1000 + 2000)) {
          // speak
          const step = routeData?.steps?.[currentStepIndex];
          if (step && step.instruction) {
            Speech.speak(step.instruction, { rate: settings.slowTts ? 0.85 : 1 });
            repeatCooldownRef.current = now;
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos, currentStepIndex, settings.autoRepeat, settings.repeatDelaySec, settings.slowTts]);

  function centerMapOnUser() {
    if (!mapRef.current || !userPos) return;
    mapRef.current.animateToRegion({
      latitude: userPos.latitude,
      longitude: userPos.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }

  function finishNavigation() {
    stopLocationWatch();
    navigation.popToTop();
  }

  const nextInstruction = routeData?.steps?.[currentStepIndex]?.instruction ?? "Magpatuloy lamang";

  return (
    <View style={styles.container}>
      <MapView
        ref={(r) => { mapRef.current = r; }}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: userPos?.latitude ?? polyCoords[0]?.latitude ?? 14.6,
          longitude: userPos?.longitude ?? polyCoords[0]?.longitude ?? 120.97,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {polyCoords.length > 0 && (
          <Polyline coordinates={polyCoords} strokeWidth={5} strokeColor="#007AFF" lineJoin="round" />
        )}

        {routeData?.destination && (
          <Marker
            coordinate={{ latitude: routeData.destination.lat, longitude: routeData.destination.lng }}
            title="Destination"
          />
        )}
      </MapView>

      {/* top controls */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={centerMapOnUser}>
          <Text style={styles.controlText}>Center</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: "#333" }]}
          onPress={() =>
            Alert.alert("Stop navigation?", "Tapos na ba ang iyong paglalakbay?", [
              { text: "Oo", onPress: finishNavigation, style: "destructive" },
              { text: "Hindi", style: "cancel" },
            ])
          }
        >
          <Text style={styles.controlText}>Exit</Text>
        </TouchableOpacity>
      </View>

      {/* bottom card */}
      <View style={[styles.bottomCard, settings.highContrast && { backgroundColor: "#000", borderColor: "#444" }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.nextLabel, settings.bigText && { fontSize: 18 }]}>Susunod:</Text>
          <Text style={[styles.instructionText, settings.bigText && { fontSize: 20 }]}>
            {nextInstruction}
          </Text>

          <Text style={[styles.etaText, settings.bigText && { fontSize: 16 }]}>ETA: {predictedEta}</Text>
        </View>

        <View style={{ justifyContent: "center", marginLeft: 8 }}>
          <TouchableOpacity style={styles.repeatBtn} onPress={repeatInstruction}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Repeat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/** Haversine - meters */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  topControls: {
    position: "absolute",
    top: 36,
    right: 12,
    flexDirection: "row",
    gap: 8,
  },
  controlBtn: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  controlText: { color: "#fff", fontWeight: "700" },
  bottomCard: {
    position: "absolute",
    bottom: 28,
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
  },
  nextLabel: { fontWeight: "800", marginBottom: 6 },
  instructionText: { fontSize: 16 },
  etaText: { marginTop: 6, color: "#555" },
  repeatBtn: { backgroundColor: "#007AFF", padding: 10, borderRadius: 8 },
});
