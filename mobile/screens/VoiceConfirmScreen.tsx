// mobile/screens/VoiceConfirmScreen.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import * as Speech from "expo-speech";
import { useSeniorMode } from "../context/SeniorModeContext";
import { RootStackParamList } from "../types/navigation";

type Props = StackScreenProps<RootStackParamList, "VoiceConfirm">;

export default function VoiceConfirmScreen({ route, navigation }: Props) {
  const { text } = route.params;
  const { settings } = useSeniorMode();

  React.useEffect(() => {
    const rate = settings.slowTts ? 0.75 : 1.0;
    Speech.speak(`Pupunta ka ba sa ${text}`, { rate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirm() {
    // navigation.replace("SearchNavigateFlow", { initialQuery: text });
    navigation.navigate('VoiceConfirm', { text });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={[styles.question, settings.bigText && { fontSize: 28 }]}>Pupunta ka ba sa</Text>
        <Text style={[styles.address, settings.bigText && { fontSize: 26 }]}>{text}</Text>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#28A745" }]} onPress={confirm}>
            <Text style={styles.btnText}>Oo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, { backgroundColor: "#DC3545" }]} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>Hindi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#fff" },
  card: { backgroundColor: "#fff", padding: 20, borderRadius: 12, alignItems: "center", elevation: 3 },
  question: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  address: { fontSize: 20, fontWeight: "600", marginBottom: 18, textAlign: "center" },
  row: { flexDirection: "row", width: "100%", justifyContent: "space-around" },
  btn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
