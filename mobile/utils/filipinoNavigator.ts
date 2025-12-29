// mobile/utils/filipinoNavigator.ts

/**
 * Filipino-style navigation phrasing
 * Optimized for English TTS voices (en-US)
 * Calm, clear, senior-friendly
 */
export function filipinoNavigator(
  instruction: string,
  distanceMeters?: number
): string {
  let text = instruction;

  // Normalize directions
  text = text.replace(/Head (north|south|east|west)/i, "Continue straight");
  text = text.replace(/Continue/i, "Continue straight");

  // Turns
  text = text.replace(/Turn left/i, "Kaliwa");
  text = text.replace(/Turn right/i, "Kanan");
  text = text.replace(/Slight left/i, "Bahagyang kaliwa");
  text = text.replace(/Slight right/i, "Bahagyang kanan");
  text = text.replace(/Make a U-turn/i, "U-turn");

  // Road phrasing
  text = text.replace(/onto/i, "papunta sa");
  text = text.replace(/toward/i, "papunta sa");

  // Distance cues (polite, not slang)
  if (distanceMeters !== undefined) {
    if (distanceMeters > 80) {
      text = `Sa susunod na kanto, ${text}`;
    } else if (distanceMeters > 30) {
      text = `Malapit na. ${text}`;
    }
  }

  return text.trim();
}
