import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Audio } from "expo-av";
// Use the legacy file-system compatibility layer for SDK 54
import * as FileSystem from "expo-file-system/legacy";
import { postMultipart } from "../utils/api";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { useSeniorMode } from "../context/SeniorModeContext";

// cross-platform recording options (works with expo-av)
const RECORDING_OPTIONS = {
  android: {
    extension: ".m4a",
    outputFormat:
      (Audio as any).RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4 || 2,
    audioEncoder:
      (Audio as any).RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC || 3,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: ".m4a",
    audioQuality:
      (Audio as any).RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH || 0,
    outputFormat:
      (Audio as any).RECORDING_OPTION_IOS_AVFAUDIO || "lpcm",
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

type Props = StackScreenProps<RootStackParamList, "VoiceRecorder">;

export default function VoiceRecorderScreen({ navigation }: Props) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [loading, setLoading] = useState(false);
  const { settings } = useSeniorMode();

  async function startRecording() {
    try {
      setLoading(true);

      // request permissions (modern API)
      const perm = await Audio.requestPermissionsAsync();
      if (!perm || perm.status !== "granted") {
        Alert.alert(
          "Permission required",
          "Microphone access is required to record voice."
        );
        setLoading(false);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(RECORDING_OPTIONS as any);
      await rec.startAsync();
      setRecording(rec);
    } catch (err) {
      console.error("startRecording error:", err);
      Alert.alert("Recording error", String(err));
    } finally {
      setLoading(false);
    }
  }

  async function stopRecordingAndUpload() {
    if (!recording) return;
    setLoading(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error("No recording URI available");

      // Use legacy FileSystem API (SDK 54 compatibility)
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo || !fileInfo.exists) {
        throw new Error("Recorded file not found: " + uri);
      }

      const filename = uri.split("/").pop() || "voice.m4a";
      const formData = new FormData();
      // @ts-ignore - React Native FormData file object
      formData.append("file", {
        uri,
        name: filename,
        type: "audio/m4a",
      });

      const res = await postMultipart("/transcribe", formData);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Transcribe failed: ${res.status} ${txt}`);
      }

      const data = await res.json();
      const text: string = data.text || "";

      if (text && settings.slowTts) {
        try {
          const Speech = await import("expo-speech");
          Speech.speak(text, { rate: 0.8 });
        } catch (e) {
          // ignore if expo-speech unavailable
        }
      }

      navigation.replace("VoiceConfirm", { text });
    } catch (err: any) {
      console.error("Upload error:", err);
      Alert.alert("Upload error", err?.message ?? String(err));
    } finally {
      setLoading(false);
      setRecording(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={[styles.title, settings.bigText && { fontSize: 22 }]}>
          Speak destination
        </Text>

        <TouchableOpacity
          onPress={recording ? stopRecordingAndUpload : startRecording}
          style={[styles.button, recording ? styles.buttonRecording : styles.buttonIdle]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {recording ? "Stop & Send" : "Start Recording"}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          {recording
            ? "Recording… Speak now, then press Stop & Send"
            : "Press Start and say the destination (short phrase)"}
        </Text>

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: "#007AFF" }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
  button: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, minWidth: 220, alignItems: "center" },
  buttonIdle: { backgroundColor: "#007AFF" },
  buttonRecording: { backgroundColor: "#DC3545" },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  hint: { marginTop: 14, color: "gray", textAlign: "center", maxWidth: 320 },
});
