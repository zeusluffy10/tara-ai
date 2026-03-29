// mobile/context/SeniorModeContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import {
  getDefaultVoiceForGender,
  loadSeniorSlowVoice,
  loadTtsEmphasis,
  loadTtsGender,
  loadTtsPauseMs,
  loadTtsVoice,
  TtsEmphasis,
  TtsGender,
} from "../utils/voiceStore";

export type SeniorSettings = {
  highContrast: boolean;
  bigText: boolean;

  // used as "slow pacing preference" now (backend tts doesn’t accept rate directly)
  slowTts: boolean;

  autoRepeat: boolean;
  repeatDelaySec: number;

  // legacy (can still be used if you keep any local audio/tts later)
  voiceRate: number;
  voiceVolume: number;

  // ✅ OpenAI voice id used by backend /tts
  ttsVoice: string;
  ttsGender: TtsGender;
  ttsPauseMs: number;
  ttsEmphasis: TtsEmphasis;

  // ✅ emotion style preference (optional; default calm)
  ttsStyle: "calm" | "warning";
};

const defaultSettings: SeniorSettings = {
  highContrast: false,
  bigText: true,
  slowTts: true,
  autoRepeat: true,
  repeatDelaySec: 5,

  voiceRate: 0.65,
  voiceVolume: 1.0,

  ttsVoice: getDefaultVoiceForGender("female"),
  ttsGender: "female",
  ttsPauseMs: 280,
  ttsEmphasis: "medium",
  ttsStyle: "calm",
};

type ContextProps = {
  seniorMode: boolean;
  setSeniorMode: (v: boolean) => void;

  settings: SeniorSettings;
  setSettings: (s: Partial<SeniorSettings>) => void;

  // ✅ derived values you should use in UI + speak calls
  effectiveSlow: boolean;
  effectiveStyle: "calm" | "warning";
};

const SeniorModeContext = createContext<ContextProps>({
  seniorMode: true,
  setSeniorMode: () => {},

  settings: defaultSettings,
  setSettings: () => {},

  effectiveSlow: true,
  effectiveStyle: "calm",
});

export const SeniorModeProvider = ({ children }: { children: ReactNode }) => {
  const [seniorMode, setSeniorMode] = useState<boolean>(true);
  const [settings, setRaw] = useState<SeniorSettings>(defaultSettings);

  const setSettings = (patch: Partial<SeniorSettings>) =>
    setRaw((s) => ({ ...s, ...patch }));

  // ✅ Load saved prefs once
  useEffect(() => {
    (async () => {
      try {
        const savedVoice = await loadTtsVoice();
        if (savedVoice) {
          setRaw((s) => ({ ...s, ttsVoice: savedVoice }));
        }
      } catch {}

      try {
        const gender = await loadTtsGender();
        setRaw((s) => ({
          ...s,
          ttsGender: gender,
          ttsVoice: s.ttsVoice || getDefaultVoiceForGender(gender),
        }));
      } catch {}

      try {
        const pauseMs = await loadTtsPauseMs();
        setRaw((s) => ({ ...s, ttsPauseMs: pauseMs }));
      } catch {}

      try {
        const emphasis = await loadTtsEmphasis();
        setRaw((s) => ({ ...s, ttsEmphasis: emphasis }));
      } catch {}

      // If you store slow toggle, load it too
      try {
        const slow = await loadSeniorSlowVoice();
        setRaw((s) => ({ ...s, slowTts: slow }));
      } catch {}
    })();
  }, []);

  // 🔒 HARD LOCK: when Senior Mode is ON
  // - force slow pacing
  // - force calm style (safer for seniors)
  useEffect(() => {
    if (seniorMode) {
      setRaw((s) => ({
        ...s,
        slowTts: true,
        ttsStyle: "calm",
        voiceRate: 0.65, // legacy, harmless to keep
      }));
    }
  }, [seniorMode]);

  // ✅ Derived values used by your speak functions
  const effectiveSlow = seniorMode ? true : settings.slowTts;
  const effectiveStyle = seniorMode ? "calm" : settings.ttsStyle;

  return (
    <SeniorModeContext.Provider
      value={{
        seniorMode,
        setSeniorMode,
        settings,
        setSettings,
        effectiveSlow,
        effectiveStyle,
      }}
    >
      {children}
    </SeniorModeContext.Provider>
  );
};

export const useSeniorMode = () => useContext(SeniorModeContext);
