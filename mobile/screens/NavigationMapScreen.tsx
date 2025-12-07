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
import * as Speech from "expo-speech";
import decodePolyline from "../utils/polylineDecode";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { useSeniorMode } from "../context/SeniorModeContext";
import { Audio } from "expo-av";

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
  // near other useState declarations
  const [nearestDist, setNearestDist] = useState<number | null>(null);

  useEffect(() => {
    // decode polyline if present
    if (routeData?.polyline) {
      const pts = decodePolyline(routeData.polyline);
      setPolyCoords(pts);
    }

    // If steps exist, initialize current index to 0 and speak instruction immediately
    if (Array.isArray(routeData?.steps) && routeData.steps.length > 0) {
      // ensure index is zero
      setCurrentStepIndex(0);
      // speak first instruction after a short delay so TTS isn't clipped by other lifecycle work
      const first = routeData.steps[0];
      const instr = first?.instruction || "Magpatuloy lamang";
      setTimeout(() => {
        try {
          Speech.speak(instr, { rate: settings.slowTts ? 0.85 : 1 });
        } catch (e) {
          console.warn("TTS speak failed:", e);
        }
        // center map on first step if possible
        const latlng = getStepLatLng(first);
        if (latlng && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: latlng.latitude,
            longitude: latlng.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          }, 600);
        } else if (polyCoords.length > 0 && mapRef.current) {
          // fallback center on polyline start
          const p = polyCoords[Math.max(0, Math.floor(polyCoords.length / 6))];
          mapRef.current.animateToRegion({ latitude: p.latitude, longitude: p.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
        }
      }, 400);
    }

    // start location watching
    startLocationWatch();

    return () => stopLocationWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Robust extractor for lat/lng for a given step object
  function getStepLatLng(step: any): LatLng | null {
    if (!step) return null;
    // Many backends use 'lat' and 'lng'
    if (typeof step.lat === "number" && typeof step.lng === "number") {
      return { latitude: step.lat, longitude: step.lng };
    }
    // Some use start_location / end_location
    const src = step.start_location || step.end_location || step.location || null;
    if (src) {
      const lat = src.lat ?? src.latitude ?? src.lat_val ?? null;
      const lng = src.lng ?? src.longitude ?? src.lng_val ?? null;
      if (typeof lat === "number" && typeof lng === "number") {
        return { latitude: lat, longitude: lng };
      }
    }
    return null;
  }

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
        try {
          Speech.speak("Nakarating ka na sa destinasyon. Salamat!", { rate: settings.slowTts ? 0.8 : 1 });
        } catch {}
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

  // returns squared distance between two lat/lngs (fast)
  function sqDist(a: LatLng, b: LatLng) {
    const dx = (a.latitude - b.latitude);
    const dy = (a.longitude - b.longitude);
    return dx * dx + dy * dy;
  }

  // distance from point P to segment AB (meters). Uses haversine on endpoints for final distance.
  function distancePointToSegment(p: LatLng, a: LatLng, b: LatLng) {
    // project p onto segment in lat/lng "space" (approx ok for small areas)
    const vx = b.latitude - a.latitude;
    const vy = b.longitude - a.longitude;
    const wx = p.latitude - a.latitude;
    const wy = p.longitude - a.longitude;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return haversineDistance(p.latitude, p.longitude, a.latitude, a.longitude);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return haversineDistance(p.latitude, p.longitude, b.latitude, b.longitude);
    const t = c1 / c2;
    const proj = { latitude: a.latitude + vx * t, longitude: a.longitude + vy * t };
    return haversineDistance(p.latitude, p.longitude, proj.latitude, proj.longitude);
  }

  // Given an encoded polyline (array of LatLng points), find the closest point on the polyline to `pt`
  // returns { point, distMeters }
  function closestPointOnPolyline(pt: LatLng, poly: LatLng[]) {
    if (!poly || poly.length === 0) return { point: null, distMeters: Number.MAX_VALUE };
    let bestPoint = poly[0];
    let bestDist = Number.MAX_VALUE;
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      const d = distancePointToSegment(pt, a, b);
      if (d < bestDist) {
        bestDist = d;
        // approximate closest point as either a, b or the projection — we can compute projection if needed
        // but for our use we only need the distance and an approximate point; pick the closer endpoint for simplicity
        const da = haversineDistance(pt.latitude, pt.longitude, a.latitude, a.longitude);
        const db = haversineDistance(pt.latitude, pt.longitude, b.latitude, b.longitude);
        bestPoint = da < db ? a : b;
      }
    }
    return { point: bestPoint, distMeters: bestDist };
  }


  function updateNearestStep(user: LatLng) {
    if (!routeData?.steps || routeData.steps.length === 0) return;

    let nearest = 0;
    let best = Number.MAX_VALUE;

    // Pre-decode step polylines if present (cache in step._polyPoints to avoid repeated decode)
    routeData.steps.forEach((s: any, i: number) => {
      if (!s._polyPoints && s.polyline) {
        try {
          s._polyPoints = decodePolyline(s.polyline); // reuse your existing decoder
        } catch (e) {
          s._polyPoints = null;
        }
      }
    });

    for (let i = 0; i < routeData.steps.length; i++) {
      const s = routeData.steps[i];

      // 1) if step has polyline -> compute closest distance from user to that step polyline
      if (s._polyPoints && s._polyPoints.length > 0) {
        const { distMeters } = closestPointOnPolyline(user, s._polyPoints);
        if (distMeters < best) {
          best = distMeters;
          nearest = i;
        }
        continue;
      }

      // 2) if step has explicit lat/lng use that
      const latlng = getStepLatLng(s);
      if (latlng) {
        const d = haversineDistance(user.latitude, user.longitude, latlng.latitude, latlng.longitude);
        if (d < best) {
          best = d;
          nearest = i;
        }
        continue;
      }

      // 3) fallback: use nearest point on overview polyline but restrict ranges (cheap)
      if (polyCoords && polyCoords.length > 0) {
        const { distMeters } = closestPointOnPolyline(user, polyCoords);
        if (distMeters < best) {
          best = distMeters;
          nearest = i;
        }
      }
    }

    // debug log
    console.log("Nearest step index:", nearest, "distanceMeters:", Math.round(best));
    setNearestDist(Math.round(best));

    // reasonable threshold: 40 meters is typical; use slight hysteresis by allowing 45 when switching forward
    const SWITCH_THRESHOLD = 45;

    if (nearest !== currentStepIndex && best < SWITCH_THRESHOLD) {
      setCurrentStepIndex(nearest);
      try { Vibration.vibrate(180); } catch {}
      const newStep = routeData.steps[nearest];
      if (newStep && newStep.instruction) {
        try { Speech.speak(newStep.instruction, { rate: settings.slowTts ? 0.85 : 1 }); } catch (e) { console.warn(e); }
      }
    }
  }

  // robust repeatInstruction() — replace your existing function
  // robust repeatInstruction() with audio-mode fix
  async function repeatInstruction() {
    try {
      console.log("DEBUG: repeatInstruction called, currentStepIndex=", currentStepIndex);
      Alert.alert("DEBUG", `Repeat pressed (step ${currentStepIndex})`);

      // Defensive fallback: try to set audio mode but only minimal fields
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
        });
        console.log("DEBUG: Audio mode set (playsInSilentModeIOS=true) [fallback attempt]");
      } catch (e) {
        console.warn("DEBUG: setAudioModeAsync fallback failed:", e);
      }

      // Stop any earlier speech
      try { await Speech.stop(); } catch (e) { console.warn("DEBUG: Speech.stop failed", e); }

      const steps = routeData?.steps;
      const total = Array.isArray(steps) ? steps.length : 0;
      if (!Array.isArray(steps) || total === 0) {
        const fallbackMsg = routeData?.fallbackMessage ?? `Proceed to destination. ETA: ${predictedEta || "unknown"}.`;
        console.log("DEBUG: no steps, speaking fallback:", fallbackMsg);
        Speech.speak(fallbackMsg, { rate: settings.slowTts ? 0.85 : 1 });
        return;
      }

      const safeIndex = Math.max(0, Math.min(total - 1, currentStepIndex));
      const step = steps[safeIndex];
      if (!step || !step.instruction) {
        const arrivalMsg = "Nakarating ka na sa destinasyon. Salamat!";
        Speech.speak(arrivalMsg, { rate: settings.slowTts ? 0.85 : 1 });
        return;
      }

      console.log("DEBUG: Speaking instruction:", step.instruction);
      Speech.speak(step.instruction, { rate: settings.slowTts ? 0.85 : 1 });
    } catch (err) {
      console.error("DEBUG: repeatInstruction unexpected error:", err);
      Alert.alert("Error", String(err));
    }
  }

  // auto-repeat when stopped (called in watch callback via handlePositionUpdate)
  useEffect(() => {
    if (!settings.autoRepeat) return;

    const interval = setInterval(async () => {
      if (!userPos) return;

      let recentSpeed = 0;
      if (lastPosRef.current) {
        const last = lastPosRef.current;
        const dt = (Date.now() - last.time) / 1000;
        if (dt > 0) {
          const d = haversineDistance(last.pos.latitude, last.pos.longitude, userPos.latitude, userPos.longitude);
          recentSpeed = d / Math.max(dt, 1);
        }
      }

      if (recentSpeed < 0.4) {
        const now = Date.now();
        if (now - (repeatCooldownRef.current ?? 0) > (settings.repeatDelaySec * 1000 + 2000)) {
          const step = routeData?.steps?.[currentStepIndex];
          if (step && step.instruction) {
            try {
              Speech.speak(step.instruction, { rate: settings.slowTts ? 0.85 : 1 });
            } catch {}
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
    }, 400);
  }

  function finishNavigation() {
    stopLocationWatch();
    navigation.popToTop();
  }

  const nextInstruction = routeData?.steps?.[currentStepIndex]?.instruction ?? "Magpatuloy lamang";

  // ---------------------
  // RETURN UI
  // ---------------------
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
          <Polyline
            coordinates={polyCoords}
            strokeWidth={5}
            strokeColor="#007AFF"
            lineJoin="round"
          />
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
        {routeData?.steps?.map((s: any, i: number) => {
          const p = getStepLatLng(s) || (s._polyPoints && s._polyPoints[0]) || null;
          if (!p) return null;
          return (
            <Marker
              key={`step-${i}`}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              pinColor={i === currentStepIndex ? "green" : "orange"}
            />
          );
        })}
      </MapView>

      {/* Top Buttons */}
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

      {/* Bottom card */}
      <View
        style={[
          styles.bottomCard,
          settings.highContrast && {
            backgroundColor: "#000",
            borderColor: "#444",
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.nextLabel, settings.bigText && { fontSize: 18 }]}>
            Susunod:
          </Text>

          <Text
            style={[styles.instructionText, settings.bigText && { fontSize: 20 }]}
          >
            {nextInstruction}
          </Text>

          <Text style={[styles.etaText, settings.bigText && { fontSize: 16 }]}>
            ETA: {predictedEta}
          </Text>
        </View>

        <View style={{ justifyContent: "center", marginLeft: 8 }}>
          <TouchableOpacity
            style={styles.repeatBtn}
            onPress={() => repeatInstruction()}
            onPressIn={() => console.log("DEBUG: onPressIn fired")}
            onLongPress={() => {
              console.log("DEBUG: onLongPress fired (force speak)");
              try {
                // force speak the current instruction as last resort
                const steps = routeData?.steps ?? [];
                const s = steps[Math.max(0, Math.min(steps.length - 1, currentStepIndex))];
                const text = s?.instruction ?? "Proceed to destination";
                Speech.speak(text);
                Alert.alert("DEBUG", "Forced speak triggered");
              } catch (e) {
                console.warn("DEBUG: forced speak error", e);
              }
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Repeat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.repeatBtn, { marginTop: 8, backgroundColor: "#28a745" }]}
            onPress={() => {
              // manual next step
              if (!routeData?.steps || routeData.steps.length === 0) return;
              setCurrentStepIndex((idx) => {
                const last = routeData.steps.length - 1;
                const next = Math.min(last, idx + 1);
                const step = routeData.steps[next];
                if (step?.instruction) {
                  Speech.speak(step.instruction, { rate: settings.slowTts ? 0.85 : 1 });
                }
                return next;
              });
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Next</Text>
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
  debugBtn: { backgroundColor: "#007AFF", padding: 8, borderRadius: 8, marginTop: 6 },
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
