import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

/**
 * Senior accessibility settings
 */
export type SeniorSettings = {
  highContrast: boolean;
  bigText: boolean;
  slowTts: boolean;        // preference (ignored when seniorMode = true)
  autoRepeat: boolean;
  repeatDelaySec: number;
  voiceRate: number;      // used only when seniorMode = false
  voiceVolume: number;
};

/**
 * Defaults for seniors
 */
const defaultSettings: SeniorSettings = {
  highContrast: false,
  bigText: true,
  slowTts: true,
  autoRepeat: true,
  repeatDelaySec: 5,
  voiceRate: 0.65,         // senior-safe default
  voiceVolume: 1.0,
};

type ContextProps = {
  seniorMode: boolean;                         // 🔒 MASTER SWITCH
  setSeniorMode: (v: boolean) => void;

  settings: SeniorSettings;
  setSettings: (s: Partial<SeniorSettings>) => void;

  /**
   * Derived values (always safe to use)
   */
  effectiveVoiceRate: number;
  effectiveVoiceVolume: number;
};

const SeniorModeContext = createContext<ContextProps>({
  seniorMode: true,
  setSeniorMode: () => {},

  settings: defaultSettings,
  setSettings: () => {},

  effectiveVoiceRate: 0.65,
  effectiveVoiceVolume: 1.0,
});

export const SeniorModeProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [seniorMode, setSeniorMode] = useState<boolean>(true);
  const [settings, setRaw] = useState<SeniorSettings>(defaultSettings);

  const setSettings = (patch: Partial<SeniorSettings>) =>
    setRaw((s) => ({ ...s, ...patch }));

  /**
   * 🔒 HARD LOCK: when Senior Mode is ON
   * - slow voice is forced
   * - voice rate is locked
   */
  useEffect(() => {
    if (seniorMode) {
      setRaw((s) => ({
        ...s,
        slowTts: true,
        voiceRate: 0.65,
      }));
    }
  }, [seniorMode]);

  /**
   * Derived values — ALWAYS use these in TTS
   */
  const effectiveVoiceRate = seniorMode
    ? 0.65
    : settings.slowTts
    ? settings.voiceRate
    : 1.0;

  const effectiveVoiceVolume = settings.voiceVolume;

  return (
    <SeniorModeContext.Provider
      value={{
        seniorMode,
        setSeniorMode,

        settings,
        setSettings,

        effectiveVoiceRate,
        effectiveVoiceVolume,
      }}
    >
      {children}
    </SeniorModeContext.Provider>
  );
};

export const useSeniorMode = () => useContext(SeniorModeContext);
