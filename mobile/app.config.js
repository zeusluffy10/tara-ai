// mobile/app.config.js
import "dotenv/config";

export default {
  expo: {
    name: "TARA AI",
    slug: "tara-ai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,

    plugins: [
      [
        "react-native-maps",
        {
          iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      ],
    ],

    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },

    ios: {
      bundleIdentifier: "com.zeusgano.taraai",
      buildNumber: "1",
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "TARA-AI uses your location to provide voice-guided navigation.",
        NSMicrophoneUsageDescription:
          "TARA-AI uses the microphone to recognize spoken destinations.",
        ITSAppUsesNonExemptEncryption: false,
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },

    android: {
      package: "com.taraai.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },

    web: {
      favicon: "./assets/favicon.png",
    },

    extra: {
      API_BASE_URL: "https://tara-ai-backend-swbp.onrender.com",
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      eas: {
        projectId: "a2559629-6873-454b-94f8-f9b034e92b16"
      }
    },  
  },
};
