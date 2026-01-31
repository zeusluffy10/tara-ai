// App.tsx
import * as React from "react";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Audio } from "expo-av";

import { RootStackParamList } from "./types/navigation";

import SeniorModeHome from "./screens/SeniorModeHome";
import VoiceRecorderScreen from "./screens/VoiceRecorderScreen";
import VoiceConfirmScreen from "./screens/VoiceConfirmScreen";
import SearchNavigateFlow from "./screens/SearchNavigateFlow";
import NavigationMapScreen from "./screens/NavigationMapScreen";
import VoiceSettingsScreen from "./screens/VoiceSettingsScreen";
import { SeniorModeProvider } from "./context/SeniorModeContext";

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // ✅ Make TTS audible even when iPhone is on Silent mode
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false, // ✅ safer for App Store
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(console.warn);
  }, []);

  return (
    <SeniorModeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="SeniorModeHome">
          <Stack.Screen
            name="SeniorModeHome"
            component={SeniorModeHome}
            options={{ title: "TARA - Senior Mode" }}
          />
          <Stack.Screen name="VoiceRecorder" component={VoiceRecorderScreen} />
          <Stack.Screen
            name="VoiceConfirm"
            component={VoiceConfirmScreen}
            options={{ title: "Confirm Destination" }}
          />
          <Stack.Screen name="SearchNavigateFlow" component={SearchNavigateFlow} />
          <Stack.Screen name="NavigationMapScreen" component={NavigationMapScreen} />
          <Stack.Screen name="VoiceSettings" component={VoiceSettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SeniorModeProvider>
  );
}

// (optional) keep only if you still want a debug floating button later
const styles = StyleSheet.create({
  debugContainer: {
    position: "absolute",
    right: 16,
    bottom: Platform.OS === "ios" ? 48 : 16,
    zIndex: 9999,
  },
  debugButton: {
    backgroundColor: "#222",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  debugText: {
    color: "#fff",
    fontWeight: "600",
  },
});
