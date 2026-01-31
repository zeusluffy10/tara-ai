// mobile/utils/speak.ts
// ✅ DEPRECATED WRAPPER — keep for backward compatibility
// All speech now goes through speakLoud (backend OpenAI TTS)

import { speakLoud } from "./tts_loud";

type Style = "calm" | "warning";

/**
 * @deprecated
 * Use speakLoud() directly.
 * This function is kept only to avoid breaking older imports.
 */
export async function speakTagalog(
  text: string,
  opts?: { voice?: string; style?: Style }
) {
  return speakLoud(text, {
    voice: opts?.voice,
    style: opts?.style ?? "calm",
  });
}
