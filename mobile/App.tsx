// mobile/App.tsx
import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

import { RootStackParamList } from "./types/navigation";

import SeniorModeHome from "./screens/SeniorModeHome";
import VoiceRecorderScreen from "./screens/VoiceRecorderScreen";
import VoiceConfirmScreen from "./screens/VoiceConfirmScreen";
import SearchNavigateFlow from "./screens/SearchNavigateFlow";
import NavigationMapScreen from "./screens/NavigationMapScreen";
import { SeniorModeProvider } from "./context/SeniorModeContext";

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
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
      </NavigationContainer>
    </SeniorModeProvider>
  );
}
