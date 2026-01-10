// mobile/components/EmergencyShare.tsx
import { Alert, Share, Linking, Platform } from "react-native";
import * as Location from "expo-location";

// Call emergency number — opens dialer
// Open Contacts app instead of dialing 911
export function emergencyCall() {
  Alert.alert(
    "Emergency",
    "What would you like to do?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send Message",
        onPress: () => {
          // SMS app ALWAYS opens on iOS & Android
          Linking.openURL("sms:");
        },
      },
      {
        text: "Call Emergency Services",
        style: "destructive",
        onPress: () => {
          Linking.openURL("tel:911");
        },
      },
    ]
  );
}


// Share live GPS location
export async function shareLiveLocation() {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(
        "Location Needed",
        "Please allow location access to share your position."
      );
      return;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude, longitude } = pos.coords;

    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    const message = `Nandito ako ngayon:\n${mapUrl}`;

    await Share.share({ message });
  } catch (err: any) {
    Alert.alert("Share failed", err?.message ?? String(err));
  }
}
