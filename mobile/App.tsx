// App.tsx
import * as React from "react";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { AudioModule } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
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
    AudioModule.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
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
            options={{
              headerLeft: () => (
                <View style={styles.headerLeft}>
                  <Ionicons name="location" size={20} color="#0A84FF" />
                  <Text style={styles.headerTitle}>TARA-AI</Text>
                </View>
              ),
              headerRight: () => (
                <View style={styles.headerRight}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.headerBadge}>Senior Mode ON</Text>
                </View>
              ),
              headerTitle: () => null,
              headerStyle: { backgroundColor: "#FFFFFF" },
              headerShadowVisible: false,
            }}
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

const styles = StyleSheet.create({
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A84FF",
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginRight: 16,
  },
  headerBadge: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16A34A",
    marginLeft: 4,
  },
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
