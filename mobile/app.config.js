// mobile/app.config.js
import "dotenv/config";

export default {
  expo: {
    extra: {
      "API_BASE_URL": "https://tara-ai-backend-swbp.onrender.com"
    },
    name: "TARA AI",
    slug: "tara-ai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,

    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },

    ios: {
       infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "TARA-AI uses your location to provide voice-guided navigation.",
        NSMicrophoneUsageDescription:
          "TARA-AI uses the microphone to recognize spoken destinations.",
      },
      supportsTablet: true,
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },

    web: {
      favicon: "./assets/favicon.png",
    },

    // ✅ THIS IS WHAT FIXES YOUR PROBLEM
    extra: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
  },
};
