import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Animated,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,  // ← add this top-level import
} from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { postMultipart } from "../utils/api";
import { RootStackParamList } from "../types/navigation";
import { useSeniorMode } from "../context/SeniorModeContext";


type Props = StackScreenProps<RootStackParamList, "VoiceRecorder">;

export default function VoiceRecorderScreen({ navigation }: Props) {
  const { settings } = useSeniorMode();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  /* PULSE ANIMATION */
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  async function startRecording() {
    try {
      setLoading(true);
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission required", "Microphone access is required.");
        return;
      }

      // 1) Switch iOS audio session to recording category
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // 2) Allocate destination file + format
      await audioRecorder.prepareToRecordAsync();

      // 3) Begin capturing (no await needed)
      audioRecorder.record();

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsRecording(true);
    } catch (err) {
      Alert.alert("Recording error", String(err));
    } finally {
      setLoading(false);
    }
  }

  async function stopRecordingAndUpload() {
    if (!isRecording) return;

    setLoading(true);
    try {
      // Read URI before stop() - it's already set after record() starts
      const uri = audioRecorder.uri;
      
      await audioRecorder.stop();
      setIsRecording(false);

      await AudioModule.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (!uri) throw new Error("Audio file missing");

      // Verify file exists and is not empty
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists || fileInfo.size === 0) 
        throw new Error("Recording is empty");

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "voice.m4a",
        type: "audio/m4a",
      } as any);

      const res = await postMultipart("/transcribe", formData);
      const data = await res.json();
      const text: string = data.text || "";

      navigation.replace("VoiceConfirm", { text });
    } catch (err: any) {
      Alert.alert("Upload error", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={["#EAF2FF", "#DDEBFF"]} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Speak Destination</Text>
        <Text style={styles.subtitle}>
          {isRecording
            ? "Listening… speak clearly"
            : "Tap the microphone and say where you want to go"}
        </Text>
      </View>

      {/* HERO MIC */}
      <View style={styles.heroContainer}>
        <View style={styles.glow} />
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.heroButton,
              isRecording && styles.heroRecording,
            ]}
            disabled={loading}
            onPress={() => {
              if (loading) return;
              isRecording ? stopRecordingAndUpload() : startRecording();
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <Ionicons
                name={isRecording ? "stop" : "mic"}
                size={56}
                color="#FFF"
              />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ACTION TEXT */}
      <Text style={styles.actionText}>
        {isRecording ? "Tap to Stop & Send" : "Tap to Start Recording"}
      </Text>

      {/* CANCEL */}
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.cancel}>Cancel</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  header: {
    marginTop: 50,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0A84FF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#5F6C80",
    marginTop: 10,
    textAlign: "center",
  },
  heroContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#0A84FF",
    opacity: 0.18,
  },
  heroButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 14,
  },
  heroRecording: {
    backgroundColor: "#FF3B30",
    shadowColor: "#FF3B30",
  },
  actionText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 24,
  },
  cancel: {
    fontSize: 18,
    color: "#0A84FF",
    marginBottom: 40,
  },
});
