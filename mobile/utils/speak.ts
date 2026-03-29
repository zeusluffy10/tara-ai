// mobile/utils/speak.ts
// ✅ DEPRECATED WRAPPER — keep for backward compatibility
// All speech now goes through speakLoud (backend OpenAI TTS)

import { speakLoud } from "./tts_loud";
import { TtsEmphasis, TtsGender } from "./voiceStore";

type Style = "calm" | "warning";

/**
 * @deprecated
 * Use speakLoud() directly.
 * This function is kept only to avoid breaking older imports.
 */
export async function speakTagalog(
  text: string,
  opts?: {
    voice?: string;
    gender?: TtsGender;
    style?: Style;
    emphasis?: TtsEmphasis;
    pauseMs?: number;
  }
) {
  return speakLoud(text, {
    voice: opts?.voice,
    gender: opts?.gender,
    style: opts?.style ?? "calm",
    emphasis: opts?.emphasis,
    pauseMs: opts?.pauseMs,
  });
}
