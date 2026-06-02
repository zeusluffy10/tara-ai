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
  SafeAreaView,
  StatusBar,
} from "react-native";
import * as Location from "expo-location";
import { StackScreenProps } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { getJSON, API_BASE } from "../utils/api";
import { handleRouteError } from "../utils/errors";
import { useSeniorMode } from "../context/SeniorModeContext";
import { RootStackParamList } from "../types/navigation";
import { speakTagalog } from "../utils/speak";

type Prediction = {
  description: string;
  place_id: string;
  distance_text?: string;
};

type Props = StackScreenProps<RootStackParamList, "SearchNavigateFlow">;

export default function SearchNavigateFlow({ route, navigation }: Props) {
  const initialQuery = route.params?.initialQuery ?? "";
  const [query, setQuery] = useState<string>(initialQuery);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [originParam, setOriginParam] = useState<string | undefined>(
    route.params?.origin
  );
  const [currentAddress, setCurrentAddress] = useState<string>("Getting your location…");
  const [locationLoading, setLocationLoading] = useState<boolean>(true);

  const { settings } = useSeniorMode();

  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
    resolveLocation();
  }, []);

  async function resolveLocation() {
    setLocationLoading(true);
    try {
      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = pos.coords;
        setOriginParam(`${latitude},${longitude}`);

        // Reverse geocode to get a readable address
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo && geo.length > 0) {
          const g = geo[0];
          const parts = [
            g.streetNumber,
            g.street,
            g.district || g.subregion,
            g.city,
          ].filter(Boolean);
          setCurrentAddress(parts.join(", ") || "Current Location");
        } else {
          setCurrentAddress("Current Location");
        }
      } else {
        setCurrentAddress("Location permission denied");
      }
    } catch (_) {
      setCurrentAddress("Unable to get location");
    } finally {
      setLocationLoading(false);
    }
  }

  async function doSearch(q: string) {
    if (!q || q.trim().length === 0) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getJSON<{ predictions: Prediction[] }>(
        `/search?q=${encodeURIComponent(q)}`
      );
      setPredictions(data.predictions || []);
    } catch (err: any) {
      Alert.alert("Search error", String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function onSelectPrediction(item: Prediction) {
    setLoading(true);
    try {
      const pd = await getJSON<{ place: any }>(
        `/placedetails?place_id=${encodeURIComponent(item.place_id)}`
      );
      const place = pd.place;
      if (!place) throw new Error("Place details missing from server");

      const addr =
        place.address ||
        place.formatted_address ||
        item.description ||
        "selected place";

      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert("Confirm destination", `Pupunta ka ba sa:\n\n${addr}`, [
          { text: "Oo", onPress: () => resolve(true) },
          { text: "Hindi", onPress: () => resolve(false), style: "cancel" },
        ]);
      });

      if (!confirmed) { setLoading(false); return; }

      let origin = originParam;
      if (!origin) {
        try {
          const pos = await Location.getCurrentPositionAsync({});
          origin = `${pos.coords.latitude},${pos.coords.longitude}`;
        } catch (_) { origin = undefined; }
      }

      const destLat = place.lat ?? place.latitude ?? place.geometry?.location?.lat;
      const destLng = place.lng ?? place.longitude ?? place.geometry?.location?.lng;
      if (destLat == null || destLng == null)
        throw new Error("Destination coordinates are missing");

      const originParamStr = origin ? `&origin=${encodeURIComponent(origin)}` : "";
      const routeUrl = `/route?destination=${encodeURIComponent(
        `${destLat},${destLng}`
      )}&mode=walking${originParamStr}`;

      const resp = await fetch(API_BASE + routeUrl);
      const data = await resp.json();

      if (!resp.ok || data.status === "error") {
        const message = handleRouteError(data);
        if (settings.slowTts) {
          try {
            await speakTagalog(message, {
              voice: settings.ttsVoice,
              gender: settings.ttsGender,
              style: "calm",
              emphasis: settings.ttsEmphasis,
              pauseMs: settings.ttsPauseMs,
            });
          } catch (e) { console.warn("TTS error:", e); }
        }
        Alert.alert("Route error", message);
        setLoading(false);
        return;
      }

      navigation.navigate("NavigationMapScreen", { routeData: data.route });
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  // Split description into name + address parts
  const splitDescription = (desc: string) => {
    const commaIdx = desc.indexOf(",");
    if (commaIdx === -1) return { name: desc, address: "" };
    return {
      name: desc.substring(0, commaIdx).trim(),
      address: desc.substring(commaIdx + 1).trim(),
    };
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      {/* ── HEADER ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#7C9FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="location" size={16} color="#7C9FFF" />
          <Text style={styles.headerTitle}>TARA-AI</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── CURRENT LOCATION BANNER ── */}
      <View style={styles.locationBanner}>
        <View style={styles.locationRow}>
          <View style={styles.locationDot}>
            <View style={styles.locationDotInner} />
          </View>
          <View style={styles.locationTextBlock}>
            <Text style={styles.locationLabel}>Your location</Text>
            {locationLoading ? (
              <View style={styles.locationLoadingRow}>
                <ActivityIndicator size="small" color="#7C9FFF" />
                <Text style={styles.locationAddress}>Getting location…</Text>
              </View>
            ) : (
              <Text style={styles.locationAddress} numberOfLines={2}>
                {currentAddress}
              </Text>
            )}
          </View>
        </View>

        {/* SEARCH INPUT */}
        <View style={styles.searchRow}>
          <View style={styles.inputWrapper}>
            <Ionicons name="search-outline" size={20} color="#7C9FFF" />
            <TextInput
              value={query}
              onChangeText={(t) => setQuery(t)}
              placeholder="Search destination…"
              placeholderTextColor="#4A5070"
              onSubmitEditing={() => doSearch(query)}
              style={styles.input}
              returnKeyType="search"
              selectionColor="#7C9FFF"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(""); setPredictions([]); }}>
                <Ionicons name="close-circle" size={20} color="#5A6480" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => doSearch(query)}
            style={styles.searchBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.searchBtnText}>Go</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── LOADING ── */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#7C9FFF" size="small" />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      )}

      {/* ── RESULTS ── */}
      <FlatList
        data={predictions}
        keyExtractor={(it) => it.place_id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const { name, address } = splitDescription(item.description);
          return (
            <TouchableOpacity
              onPress={() => onSelectPrediction(item)}
              style={styles.resultCard}
              activeOpacity={0.75}
            >
              <View style={styles.resultIconBox}>
                <Ionicons name="location" size={22} color="#7C9FFF" />
              </View>
              <View style={styles.resultText}>
                <Text
                  style={[styles.resultName, settings.bigText && { fontSize: 18 }]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                {address ? (
                  <Text style={styles.resultAddress} numberOfLines={2}>
                    {address}
                  </Text>
                ) : null}
                {item.distance_text ? (
                  <Text style={styles.resultDistance}>{item.distance_text}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#3A3A5C" />
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() =>
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={52} color="#2D2D4A" />
              <Text style={styles.emptyTitle}>
                {query.length > 0 ? "No results found" : "Search for a destination"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {query.length > 0
                  ? "Try a different keyword or address"
                  : "Type a place name or address above"}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

/* ── STYLES ── */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },

  /* TOP BAR */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2D2D4A",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#C8D0FF",
    letterSpacing: 1,
    marginLeft: 4,
  },

  /* LOCATION BANNER */
  locationBanner: {
    backgroundColor: "#252540",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#2D2D4A",
    gap: 16,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  locationDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#7C9FFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  locationDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7C9FFF",
  },
  locationTextBlock: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: "#5A6480",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  locationLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationAddress: {
    fontSize: 16,
    color: "#E8EEFF",
    fontWeight: "600",
    lineHeight: 22,
  },

  /* SEARCH ROW */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3A3A5C",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#E8EEFF",
  },
  searchBtn: {
    backgroundColor: "#4A4AFF",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  /* LOADING */
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 15,
    color: "#7C9FFF",
  },

  /* RESULT CARDS */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  separator: {
    height: 8,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252540",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#3A3A5C",
    gap: 14,
  },
  resultIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#1E2545",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  resultText: {
    flex: 1,
    gap: 3,
  },
  resultName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E8EEFF",
  },
  resultAddress: {
    fontSize: 13,
    color: "#5A6480",
    lineHeight: 18,
  },
  resultDistance: {
    fontSize: 12,
    color: "#7C9FFF",
    fontWeight: "600",
    marginTop: 2,
  },

  /* EMPTY */
  emptyState: {
    alignItems: "center",
    marginTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#5A6480",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#3A3A5C",
    textAlign: "center",
    paddingHorizontal: 30,
  },
});
