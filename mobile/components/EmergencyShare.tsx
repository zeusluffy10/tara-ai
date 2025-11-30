// mobile/components/EmergencyShare.tsx
import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  Share,
} from "react-native";
import { Linking } from "react-native";        // ✅ Using React Native Linking
import * as Location from "expo-location";

export default function EmergencyShare() {
  // Call emergency number — opens dialer
  async function makeCall() {
    const emergencyNumber = "911"; // For PH you can also use 117 if needed
    const url = `tel:${emergencyNumber}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Dialer Not Available", "Your device cannot open the phone dialer.");
        return;
      }
      await Linking.openURL(url); // Opens phone app
    } catch (err) {
      Alert.alert("Call failed", String(err));
    }
  }

  // Share live GPS location
  async function shareLocation() {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Location Needed", "Please allow location to share your position.");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;

      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      const message = `Nandito ako ngayon: ${mapUrl}`;

      await Share.share({ message });
    } catch (err) {
      Alert.alert("Share failed", String(err));
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.btn, { backgroundColor: "#DC3545" }]} onPress={makeCall}>
        <Text style={styles.btnText}>🚨 Emergency Call</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: "#FF8C00", marginTop: 12 }]}
        onPress={shareLocation}
      >
        <Text style={styles.btnText}>📍 Share Location</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    marginTop: 20,
  },
  btn: {
    width: "90%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
});
