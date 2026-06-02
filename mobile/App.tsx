// App.tsx
import * as React from "react";
import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { AudioModule } from "expo-audio";
import { RootStackParamList } from "./types/navigation";
import SeniorModeHome from "./screens/SeniorModeHome";
import VoiceRecorderScreen from "./screens/VoiceRecorderScreen";
import VoiceConfirmScreen from "./screens/VoiceConfirmScreen";
import SearchNavigateFlow from "./screens/SearchNavigateFlow";
import NavigationMapScreen from "./screens/NavigationMapScreen";
import VoiceSettingsScreen from "./screens/VoiceSettingsScreen";
import SettingsScreen from "./screens/SettingsScreen";
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
            options={{ headerShown: false }}
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
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SeniorModeProvider>
  );
}
