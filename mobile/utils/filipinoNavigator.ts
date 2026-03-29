const actionTranslations: Record<string, string> = {
  "head north": "dumiretso pahilaga",
  "head south": "dumiretso patimog",
  "head east": "dumiretso pasilangan",
  "head west": "dumiretso pakanluran",
  continue: "magpatuloy",
  "keep left": "manatili sa kaliwa",
  "keep right": "manatili sa kanan",
  "turn left": "lumiko pakaliwa",
  "turn right": "lumiko pakanan",
  "slight left": "bahagyang lumiko pakaliwa",
  "slight right": "bahagyang lumiko pakanan",
  "make a u-turn": "mag-U-turn",
  "u-turn": "U-turn",
  exit: "lumabas",
  "take the exit": "dumaan sa labasan",
  merge: "sumanib sa daan",
  "destination will be on the left": "ang pupuntahan ay nasa kaliwa",
  "destination will be on the right": "ang pupuntahan ay nasa kanan",
  "you have arrived": "nakarating na tayo",
};

const actionPattern = new RegExp(
  Object.keys(actionTranslations)
    .sort((left, right) => right.length - left.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "gi"
);

const distancePatterns = [
  /\b(?:in|after)\s+(?<amount>\d+(?:\.\d+)?)\s*(?<unit>meters?|meter|m|kilometers?|kilometer|km)\b[, ]*(?<rest>.+)/i,
  /^(?<rest>.+?)\s+\b(?:in|after)\s+(?<amount>\d+(?:\.\d+)?)\s*(?<unit>meters?|meter|m|kilometers?|kilometer|km)\b/i,
];

function toDistancePhrase(amount: string, unit: string) {
  const numeric = Number(amount);
  const rendered = Number.isFinite(numeric) && Number.isInteger(numeric) ? String(numeric) : amount;
  return /km|kilometer/i.test(unit) ? `${rendered} kilometro` : `${rendered} metro`;
}

function translateActions(text: string) {
  return text.replace(actionPattern, (value) => actionTranslations[value.toLowerCase()] ?? value);
}

function rewriteDistanceFirst(text: string) {
  for (const pattern of distancePatterns) {
    const match = text.match(pattern);
    const groups = match?.groups;
    if (!groups?.rest || !groups.amount || !groups.unit) continue;
    return `Sa ${toDistancePhrase(groups.amount, groups.unit)}, ${translateActions(groups.rest.trim())}`;
  }

  return text;
}

export function filipinoNavigator(instruction: string, distanceMeters?: number) {
  let text = (instruction || "").trim();

  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/\s+/g, " ").trim();
  text = rewriteDistanceFirst(text);
  text = translateActions(text);
  text = text.replace(/\bonto\b/gi, "papunta sa");
  text = text.replace(/\btoward\b/gi, "papunta sa");
  text = text.replace(/\bvia\b/gi, "dumaan sa");

  if (typeof distanceMeters === "number" && isFinite(distanceMeters)) {
    const meters = Math.max(1, Math.round(distanceMeters));
    text = meters >= 15 ? `Sa ${meters} metro, ${text}` : `Malapit na. ${text}`;
  }

  text = text.trim();
  if (text && !/[.!?]$/.test(text)) text += ".";
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
