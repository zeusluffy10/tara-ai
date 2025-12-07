import * as React from "react";
import { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

import { RootStackParamList } from "./types/navigation";

import SeniorModeHome from "./screens/SeniorModeHome";
import VoiceRecorderScreen from "./screens/VoiceRecorderScreen";
import VoiceConfirmScreen from "./screens/VoiceConfirmScreen";
import SearchNavigateFlow from "./screens/SearchNavigateFlow";
import NavigationMapScreen from "./screens/NavigationMapScreen";
import { SeniorModeProvider } from "./context/SeniorModeContext";

import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

const Stack = createStackNavigator<RootStackParamList>();

async function enablePlaybackInSilentMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true, // core requirement for iOS navigation prompts
      shouldDuckAndroid: false,
    });
    console.log("DEBUG: App audio mode set (playsInSilentModeIOS=true)");
  } catch (e) {
    console.warn("DEBUG: setAudioModeAsync at app start failed:", e);
  }
}

// --- small beep test using a local asset (recommended) ---
// Put a small file `assets/beep.wav` in your project and reference it here.
async function playBeep() {
  try {
    const { sound } = await Audio.Sound.createAsync(
      require("./assets/beep.wav"),
      { shouldPlay: true, volume: 1.0 }
    );
    console.log("DEBUG: beep played");
    // unload to free resources after 2s
    setTimeout(() => {
      sound.unloadAsync().catch(() => {});
    }, 2000);
  } catch (e) {
    console.warn("DEBUG: playBeep failed:", e);
  }
}

export default function App() {
  useEffect(() => {
    enablePlaybackInSilentMode();
  }, []);

  const debugRepeat = async () => {
    console.log("DEBUG: debugRepeat pressed");
    // call your repeatInstruction() here
    // await repeatInstruction();
    // For now, run a beep to test audio routing:
    await playBeep();
  };

  return (
    <SeniorModeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="SeniorModeHome">
          <Stack.Screen name="SeniorModeHome" component={SeniorModeHome} options={{ title: "TARA - Senior Mode" }} />
          <Stack.Screen name="VoiceRecorder" component={VoiceRecorderScreen} />
          <Stack.Screen name="VoiceConfirm" component={VoiceConfirmScreen} options={{ title: "Confirm Destination" }} />
          <Stack.Screen name="SearchNavigateFlow" component={SearchNavigateFlow} />
          <Stack.Screen name="NavigationMapScreen" component={NavigationMapScreen} />
        </Stack.Navigator>

        {/* Floating debug button — easy test anywhere in the app */}
        {/* <View pointerEvents="box-none" style={styles.debugContainer}>
          <TouchableOpacity activeOpacity={0.8} style={styles.debugButton} onPress={debugRepeat}>
            <Text style={styles.debugText}>Play beep</Text>
          </TouchableOpacity>
        </View> */}
      </NavigationContainer>
    </SeniorModeProvider>
  );
}


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
