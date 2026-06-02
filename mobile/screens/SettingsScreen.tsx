import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";

type Props = StackScreenProps<RootStackParamList, "Settings">;

const STORAGE_KEY = "tara_saved_places";

const PLACE_ICONS: Record<string, string> = {
  Home: "home-outline",
  Hospital: "medkit-outline",
  Church: "heart-outline",
  Market: "cart-outline",
  Custom: "location-outline",
};

const DEFAULT_PLACES = [
  { id: "1", label: "Home", address: "" },
  { id: "2", label: "Hospital", address: "" },
];

type SavedPlace = {
  id: string;
  label: string;
  address: string;
};

export default function SettingsScreen({ navigation }: Props) {
  const [places, setPlaces] = useState<SavedPlace[]>(DEFAULT_PLACES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editLabel, setEditLabel] = useState("");

  useEffect(() => {
    loadPlaces();
  }, []);

  const loadPlaces = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setPlaces(JSON.parse(data));
    } catch (_) {}
  };

  const savePlaces = async (updated: SavedPlace[]) => {
    setPlaces(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}
  };

  const startEdit = (place: SavedPlace) => {
    setEditingId(place.id);
    setEditAddress(place.address);
    setEditLabel(place.label);
  };

  const confirmEdit = () => {
    const updated = places.map((p) =>
      p.id === editingId
        ? { ...p, label: editLabel, address: editAddress }
        : p
    );
    savePlaces(updated);
    setEditingId(null);
  };

  const deletePlace = (id: string) => {
    Alert.alert("Remove Place", "Remove this saved place?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => savePlaces(places.filter((p) => p.id !== id)),
      },
    ]);
  };

  const addPlace = () => {
    const newPlace: SavedPlace = {
      id: Date.now().toString(),
      label: "Custom",
      address: "",
    };
    const updated = [...places, newPlace];
    savePlaces(updated);
    startEdit(newPlace);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#7C9FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* SAVED PLACES */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="star-outline" size={18} color="#7C9FFF" />
            <Text style={styles.sectionTitle}>Saved Places</Text>
          </View>
          <Text style={styles.sectionSub}>
            Tap a place to set or update its address.
          </Text>

          {places.map((place) => (
            <View key={place.id}>
              {editingId === place.id ? (
                <View style={styles.editCard}>
                  <Text style={styles.editHint}>Place name</Text>
                  <TextInput
                    style={styles.input}
                    value={editLabel}
                    onChangeText={setEditLabel}
                    placeholder="e.g. Home, Hospital"
                    placeholderTextColor="#4A5070"
                    selectionColor="#7C9FFF"
                  />
                  <Text style={[styles.editHint, { marginTop: 10 }]}>Address</Text>
                  <TextInput
                    style={styles.input}
                    value={editAddress}
                    onChangeText={setEditAddress}
                    placeholder="e.g. 123 Main St, Manila"
                    placeholderTextColor="#4A5070"
                    selectionColor="#7C9FFF"
                    multiline
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setEditingId(null)}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={confirmEdit}>
                      <Text style={styles.saveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.placeCard}
                  activeOpacity={0.8}
                  onPress={() => startEdit(place)}
                >
                  <View style={styles.placeIcon}>
                    <Ionicons
                      name={(PLACE_ICONS[place.label] ?? "location-outline") as any}
                      size={24}
                      color="#7C9FFF"
                    />
                  </View>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeLabel}>{place.label}</Text>
                    <Text style={styles.placeAddress} numberOfLines={1}>
                      {place.address || "Tap to set address"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deletePlace(place.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#5A6480" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={addPlace} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={22} color="#4A4AFF" />
            <Text style={styles.addText}>Add a Place</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1A1A2E" },
  scroll: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2D2D4A",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#C8D0FF",
  },

  section: {
    backgroundColor: "#252540",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#3A3A5C",
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#C8D0FF",
    marginLeft: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: "#5A6480",
    marginBottom: 16,
  },

  placeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2D2D4A",
  },
  placeIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#1E2545",
    alignItems: "center",
    justifyContent: "center",
  },
  placeInfo: { flex: 1 },
  placeLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#C8D0FF",
  },
  placeAddress: {
    fontSize: 13,
    color: "#5A6480",
    marginTop: 3,
  },

  editCard: {
    backgroundColor: "#1E2545",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#3A3A5C",
  },
  editHint: {
    fontSize: 12,
    color: "#7C9FFF",
    marginBottom: 6,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#252540",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#E8EEFF",
    borderWidth: 1,
    borderColor: "#3A3A5C",
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#2D2D4A",
    alignItems: "center",
  },
  cancelText: {
    color: "#8892AA",
    fontWeight: "600",
    fontSize: 15,
  },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#4A4AFF",
    alignItems: "center",
  },
  saveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#4A4AFF",
    borderStyle: "dashed",
  },
  addText: {
    fontSize: 16,
    color: "#4A4AFF",
    fontWeight: "600",
  },
});
