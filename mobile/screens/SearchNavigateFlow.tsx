// mobile/screens/SearchNavigateFlow.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import * as Location from "expo-location";
import { StackScreenProps } from "@react-navigation/stack";
import { getJSON, API_BASE } from "../utils/api";
import { handleRouteError } from "../utils/errors";
import { useSeniorMode } from "../context/SeniorModeContext";
import { RootStackParamList } from "../types/navigation";

type Prediction = {
  description: string;
  place_id: string;
};

type Props = StackScreenProps<RootStackParamList, "SearchNavigateFlow">;

export default function SearchNavigateFlow({ route, navigation }: Props) {
  const initialQuery = route.params?.initialQuery ?? "";
  const [query, setQuery] = useState<string>(initialQuery);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [originParam, setOriginParam] = useState<string | undefined>(route.params?.origin);

  const { settings } = useSeniorMode();

  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery);
    }

    // Try to resolve device location once (non-blocking)
    (async () => {
      if (!originParam) {
        try {
          const locPerm = await Location.requestForegroundPermissionsAsync();
          if (locPerm.status === "granted") {
            const pos = await Location.getCurrentPositionAsync({});
            setOriginParam(`${pos.coords.latitude},${pos.coords.longitude}`);
          }
        } catch (e) {
          // ignore; backend will geocode if needed
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch(q: string) {
    if (!q || q.trim().length === 0) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    try {
      // getJSON uses API_BASE and throws on http errors
      const data = await getJSON<{ predictions: Prediction[] }>(`/search?q=${encodeURIComponent(q)}`);
      setPredictions(data.predictions || []);
    } catch (err: any) {
      console.error("Search error:", err);
      Alert.alert("Search error", String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function onSelectPrediction(item: Prediction) {
    setLoading(true);
    try {
      // 1) Get place details (via backend)
      const pd = await getJSON<{ place: any }>(`/placedetails?place_id=${encodeURIComponent(item.place_id)}`);
      const place = pd.place;
      if (!place) throw new Error("Place details missing from server");

      // Build a readable address for confirmation
      const addr = place.address || place.formatted_address || item.description || "selected place";

      // Confirm with user (senior-friendly)
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert("Confirm destination", `Pupunta ka ba sa:\n\n${addr}`, [
          { text: "Oo", onPress: () => resolve(true) },
          { text: "Hindi", onPress: () => resolve(false), style: "cancel" },
        ]);
      });

      if (!confirmed) {
        setLoading(false);
        return;
      }

      // 2) Prepare origin (prefers device originParam)
      let origin = originParam;
      if (!origin) {
        try {
          const pos = await Location.getCurrentPositionAsync({});
          origin = `${pos.coords.latitude},${pos.coords.longitude}`;
        } catch (_) {
          // last resort: ask backend to geocode (we'll pass place lat,lng as origin fallback)
          origin = undefined;
        }
      }

      // 3) Build destination (ensure lat/lng present)
      const destLat = place.lat ?? place.latitude ?? place.geometry?.location?.lat;
      const destLng = place.lng ?? place.longitude ?? place.geometry?.location?.lng;
      if (destLat == null || destLng == null) {
        throw new Error("Destination coordinates are missing");
      }

      // 4) Call /route endpoint via API helper so API_BASE works on device
      // If we have origin string, include it; otherwise omit and let backend geocode
      const originParamStr = origin ? `&origin=${encodeURIComponent(origin)}` : "";
      const routeUrl = `/route?destination=${encodeURIComponent(`${destLat},${destLng}`)}&mode=walking${originParamStr}`;

      // Use fetch + JSON because backend returns structured {status: "ok"|"error", ...}
      const resp = await fetch(API_BASE + routeUrl);
      const data = await resp.json();

      if (!resp.ok || data.status === "error") {
        const message = handleRouteError(data);
        // speak error for seniors (if enabled)
        if (settings.slowTts) {
          try {
            const Speech = await import("expo-speech");
            Speech.speak(message, { rate: 0.8 });
          } catch {}
        }
        Alert.alert("Route error", message);
        setLoading(false);
        return;
      }

      const routeObj = data.route;
      // Navigate to NavigationMapScreen with normalized route object
      navigation.navigate("NavigationMapScreen", { routeData: routeObj });
    } catch (err: any) {
      console.error("onSelectPrediction error:", err);
      Alert.alert("Error", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, settings.highContrast && { backgroundColor: "#000" }]}>
      <Text style={[styles.label, settings.bigText && { fontSize: 20, color: settings.highContrast ? "#FFD700" : undefined }]}>
        Search destination
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={(t) => setQuery(t)}
          placeholder="Type or speak a place"
          onSubmitEditing={() => doSearch(query)}
          style={[styles.input, settings.highContrast && { backgroundColor: "#111", color: "#fff", borderColor: "#444" }]}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => doSearch(query)} style={styles.searchBtn}>
          <Text style={{ color: "#fff" }}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

      <FlatList
        style={{ marginTop: 12 }}
        data={predictions}
        keyExtractor={(it) => it.place_id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onSelectPrediction(item)} style={[styles.predItem, settings.highContrast && { borderColor: "#333" }]}>
            <Text style={[styles.predTitle, settings.bigText && { fontSize: 18, color: settings.highContrast ? "#fff" : undefined }]}>
              {item.description}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() =>
          !loading ? <Text style={{ textAlign: "center", color: "gray", marginTop: 24 }}>No results</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  searchRow: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  searchBtn: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  predItem: { paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  predTitle: { fontSize: 15 },
});
