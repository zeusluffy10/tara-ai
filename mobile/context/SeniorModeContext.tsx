// mobile/context/SeniorModeContext.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";

type SeniorSettings = {
  highContrast: boolean;
  bigText: boolean;
  slowTts: boolean;
  autoRepeat: boolean;
  repeatDelaySec: number; // seconds to wait when stopped before repeating
  voiceRate: number;   // 0.7 – 1.3 (speed)
  voiceVolume: number; // 0.5 – 1.0 (loudness)
};

const defaultSettings: SeniorSettings = {
  highContrast: false,
  bigText: true,
  slowTts: true,
  autoRepeat: true,
  repeatDelaySec: 5,
  voiceRate: 1.0,
  voiceVolume: 1.0,
};

type ContextProps = {
  settings: SeniorSettings;
  setSettings: (s: Partial<SeniorSettings>) => void;
};

const SeniorModeContext = createContext<ContextProps>({
  settings: defaultSettings,
  setSettings: () => {},
});

export const SeniorModeProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setRaw] = useState<SeniorSettings>(defaultSettings);
  const setSettings = (patch: Partial<SeniorSettings>) => setRaw((s) => ({ ...s, ...patch }));
  return (
    <SeniorModeContext.Provider value={{ settings, setSettings }}>
      {children}
    </SeniorModeContext.Provider>
  );
};

export const useSeniorMode = () => useContext(SeniorModeContext);
