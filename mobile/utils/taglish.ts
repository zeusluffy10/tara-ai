// mobile/utils/taglish.ts

export function toTaglish(
  instruction: string,
  distanceMeters?: number
): string {
  let text = instruction;

  // Normalize
  text = text.replace(/\s+/g, " ").trim();

  // Direction translations
  text = text.replace(/turn left/i, "Lumiko ka sa kaliwa");
  text = text.replace(/turn right/i, "Lumiko ka sa kanan");
  text = text.replace(/slight left/i, "Bahagyang kaliwa");
  text = text.replace(/slight right/i, "Bahagyang kanan");
  text = text.replace(/keep left/i, "Manatili sa kaliwa");
  text = text.replace(/keep right/i, "Manatili sa kanan");

  // Movement
  text = text.replace(/continue/i, "Magpatuloy");
  text = text.replace(/head/i, "Dumiretso");
  text = text.replace(/merge/i, "Pumasok");
  text = text.replace(/exit/i, "Lumabas");

  // Destination
  text = text.replace(
    /destination will be on the left/i,
    "Nasa kaliwa na ang destinasyon"
  );
  text = text.replace(
    /destination will be on the right/i,
    "Nasa kanan na ang destinasyon"
  );

  // 🧠 Landmark logic (distance-based)
  if (distanceMeters !== undefined) {
    if (distanceMeters < 20) {
      text += ". Andiyan na mismo";
    } else if (distanceMeters < 40) {
      text += ". Malapit na sa kanto";
    } else if (distanceMeters < 80) {
      text += ". May kanto sa unahan";
    } else if (distanceMeters < 150) {
      text += ". Bandang unahan";
    }
  }

  // Make it calm & polite
  if (!text.endsWith(".")) text += ".";

  return text;
}
