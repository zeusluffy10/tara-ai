// mobile/screens/VoiceConfirmScreen.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";

import { speakWithBestVoice } from "../utils/ttts";   // ✅ NEW SHARED HELPER
import { useSeniorMode } from "../context/SeniorModeContext";
import { RootStackParamList } from "../types/navigation";

type Props = StackScreenProps<RootStackParamList, "VoiceConfirm">;

export default function VoiceConfirmScreen({ route, navigation }: Props) {
  const { text } = route.params;
  const { settings } = useSeniorMode();

  // Speak the question on mount
  React.useEffect(() => {
    speakWithBestVoice(`Pupunta ka ba sa ${text}`, settings.slowTts);
  }, []);

  // -------------------------
  // Beep tester (no asset required)
  // -------------------------
  async function playBeep() {
    try {
       const { sound } = await Audio.Sound.createAsync(
              require("../assets/beep.wav"), 
              { shouldPlay: true, volume: 1.0 }
            );

      console.log("DEBUG: beep played");
      setTimeout(() => sound.unloadAsync().catch(() => {}), 1500);
    } catch (e) {
      console.warn("DEBUG: playBeep error:", e);
    }
  }

  // -------------------------
  // Confirm handler
  // -------------------------
  async function confirm() {
    try {
      console.log("DEBUG: confirm() start");
      Alert.alert("DEBUG", "Oo pressed");

      const msg = `Ok. Dadalhin kita sa ${text.replace(/-/g, " ")}`;
      await speakWithBestVoice(msg, settings.slowTts);

      navigation.navigate("SearchNavigateFlow", { initialQuery: text });

    } catch (err) {
      console.error("DEBUG: confirm error:", err);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>

        <Text style={[styles.question, settings.bigText && { fontSize: 28 }]}>
          Pupunta ka ba sa
        </Text>

        <Text style={[styles.address, settings.bigText && { fontSize: 26 }]}>
          {text}
        </Text>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#28A745" }]}
            onPress={confirm}
          >
            <Text style={styles.btnText}>Oo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#DC3545" }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.btnText}>Hindi</Text>
          </TouchableOpacity>
        </View>

        {/* Debug buttons - optional */}
        <View style={{ marginTop: 30 }}>
          <TouchableOpacity onPress={playBeep} style={debugBtn}>
            <Text style={debugBtnText}>Play Beep</Text>
          </TouchableOpacity>

          <View style={{ height: 10 }} />

          <TouchableOpacity
            onPress={() =>
              speakWithBestVoice("Ito ay test ng boses", settings.slowTts)
            }
            style={debugBtn}
          >
            <Text style={debugBtnText}>Speak Test</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const debugBtn = {
  backgroundColor: "#000",
  padding: 12,
  borderRadius: 8,
  minWidth: 200,
  alignItems: "center",
} as const;

const debugBtnText = {
  color: "white",
  fontWeight: "700",
  fontSize: 16,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#fff" },
  card: { backgroundColor: "#fff", padding: 20, borderRadius: 12, alignItems: "center", elevation: 3 },
  question: { fontSize: 20, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  address: { fontSize: 20, fontWeight: "600", marginBottom: 18, textAlign: "center" },
  row: { flexDirection: "row", width: "100%", justifyContent: "space-around", marginTop: 14 },
  btn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});


// // mobile/screens/VoiceConfirmScreen.tsx
// import React from "react";
// import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
// import { StackScreenProps } from "@react-navigation/stack";
// import * as Speech from "expo-speech";
// import { Audio } from "expo-av";
// import { useSeniorMode } from "../context/SeniorModeContext";
// import { RootStackParamList } from "../types/navigation";

// type Props = StackScreenProps<RootStackParamList, "VoiceConfirm">;

// export default function VoiceConfirmScreen({ route, navigation }: Props) {
//   const { text } = route.params;
//   const { settings } = useSeniorMode();

//   React.useEffect(() => {
//     const rate = settings.slowTts ? 0.75 : 1.0;
//     // speak the confirmation question on mount
//     try {
//       Speech.speak(`Pupunta ka ba sa ${text}`, { rate });
//     } catch (e) {
//       console.warn("DEBUG: initial Speech.speak failed", e);
//     }

//     // cleanup on unmount: stop any ongoing speech
//     return () => {
//       try {
//         Speech.stop();
//       } catch (e) {
//         // ignore
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // Robust confirm handler
//   async function confirm() {
//     try {
//       console.log("DEBUG: confirm() start");
//       Alert.alert("DEBUG", "Oo pressed");

//       // Ensure audio mode allows playback in silent mode (best-effort)
//       try {
//         await Audio.setAudioModeAsync({
//           allowsRecordingIOS: false,
//           staysActiveInBackground: false,
//           playsInSilentModeIOS: true, // important for iOS silent switch
//           shouldDuckAndroid: false,
//         });
//         console.log("DEBUG: Audio mode set (playsInSilentModeIOS=true)");
//       } catch (e) {
//         console.warn("DEBUG: setAudioModeAsync failed:", e);
//       }

//       // Stop any prior speech so new prompt is heard
//       try {
//         await Speech.stop();
//       } catch (e) {
//         console.warn("DEBUG: Speech.stop failed", e);
//       }

//       // Speak a short confirmation (optional)
//       const rate = settings.slowTts ? 0.85 : 1.0;
//       const confirmMsg = `Ok. Dadalhin kita sa ${text.replace(/-/g, " ")}`;
//       try {
//         Speech.speak(confirmMsg, { rate });
//         console.log("DEBUG: Speech.speak called:", confirmMsg);
//       } catch (e) {
//         console.warn("DEBUG: Speech.speak error", e);
//       }

//       // Navigate to the flow that begins searching / navigation
//       // - Adjust route name and params as your app expects
//       navigation.navigate("SearchNavigateFlow", { initialQuery: text });
//       console.log("DEBUG: navigation.navigate SearchNavigateFlow", text);
//     } catch (err) {
//       console.error("DEBUG: confirm unexpected error:", err);
//       Alert.alert("Error", String(err));
//     }
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       <View style={styles.card}>
//         <Text style={[styles.question, settings.bigText && { fontSize: 28 }]}>Pupunta ka ba sa</Text>
//         <Text style={[styles.address, settings.bigText && { fontSize: 26 }]}>{text}</Text>

//         <View style={styles.row}>
//           <TouchableOpacity
//             style={[styles.btn, { backgroundColor: "#28A745" }]}
//             onPress={confirm}
//             activeOpacity={0.85}
//           >
//             <Text style={styles.btnText}>Oo</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[styles.btn, { backgroundColor: "#DC3545" }]}
//             onPress={() => navigation.goBack()}
//             activeOpacity={0.85}
//           >
//             <Text style={styles.btnText}>Hindi</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#fff" },
//   card: { backgroundColor: "#fff", padding: 20, borderRadius: 12, alignItems: "center", elevation: 3 },
//   question: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
//   address: { fontSize: 20, fontWeight: "600", marginBottom: 18, textAlign: "center" },
//   row: { flexDirection: "row", width: "100%", justifyContent: "space-around" },
//   btn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
//   btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
// });
