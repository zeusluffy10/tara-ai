// mobile/utils/fetchRouteAndNavigate.ts
import { Alert } from "react-native";

const API_BASE = "https://faster-touched-workplace-airline.trycloudflare.com";

export async function fetchRouteAndNavigate(origin: string, destination: string, navigation: any) {
  try {
    const url = `${API_BASE}/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    console.log("Requesting route:", url);
    const res = await fetch(url);
    const text = await res.text();
    console.log("/route body (truncated):", text.slice(0, 1000));
    if (!res.ok) {
      Alert.alert("Route error", `Server returned ${res.status}`);
      return;
    }
    const json = JSON.parse(text);
    const route = json.route || json;
    // Defensive extraction:
    const steps = route.steps && Array.isArray(route.steps) ? route.steps : [];
    const distance = (route.distance && route.distance.text) || route.distance?.text || route.routes?.[0]?.legs?.[0]?.distance?.text || null;
    const duration = (route.duration && route.duration.text) || route.duration?.text || route.routes?.[0]?.legs?.[0]?.duration?.text || null;
    const polyline = route.polyline || route.overview_polyline || route.routes?.[0]?.overview_polyline?.points || null;

    // If no steps, pass fallback so map screen can show overview
    const hasSteps = steps.length > 0;

    navigation.replace("NavigationMapScreen", {
      routeJson: route,
      steps,
      hasSteps,
      polyline,
      fallback: { distance, duration },
    });
  } catch (err) {
    console.error("fetchRoute error", err);
    Alert.alert("Network error", String(err));
  }
}
