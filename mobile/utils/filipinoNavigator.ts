export function filipinoNavigator(instruction: string, distanceMeters?: number) {
  let t = (instruction || "").trim();

  // Remove HTML if any
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/\s+/g, " ").trim();

  // Pure Tagalog replacements
  const rules: Array<[RegExp, string]> = [
    [/\bHead north\b/gi, "Dumiretso pahilaga"],
    [/\bHead south\b/gi, "Dumiretso patimog"],
    [/\bHead east\b/gi, "Dumiretso pasilangan"],
    [/\bHead west\b/gi, "Dumiretso pakanluran"],

    [/\bContinue\b/gi, "Magpatuloy"],
    [/\bKeep left\b/gi, "Manatili sa kaliwa"],
    [/\bKeep right\b/gi, "Manatili sa kanan"],

    [/\bTurn left\b/gi, "Kumaliwa"],
    [/\bTurn right\b/gi, "Kumanan"],
    [/\bSlight left\b/gi, "Bahagyang kumaliwa"],
    [/\bSlight right\b/gi, "Bahagyang kumanan"],

    [/\bMake a U-turn\b/gi, "Mag-U-turn"],
    [/\bU-turn\b/gi, "U-turn"],

    [/\bExit\b/gi, "Lumabas"],
    [/\bTake the exit\b/gi, "Dumaan sa labasan"],
    [/\bMerge\b/gi, "Sumanib sa daan"],

    [/\bDestination will be on the left\b/gi, "Ang pupuntahan ay nasa kaliwa"],
    [/\bDestination will be on the right\b/gi, "Ang pupuntahan ay nasa kanan"],
    [/\bYou have arrived\b/gi, "Nakarating na tayo"],
  ];

  for (const [re, rep] of rules) t = t.replace(re, rep);

  // distance prefix in Tagalog
  if (typeof distanceMeters === "number" && isFinite(distanceMeters)) {
    const m = Math.max(1, Math.round(distanceMeters));
    if (m >= 15) {
      t = `Pagkalipas ng ${m} metro, ${t}`;
    } else {
      t = `Malapit na. ${t}`;
    }
  }

  // punctuation for natural TTS
  t = t.trim();
  if (t && !/[.!?]$/.test(t)) t += ".";

  return t;
}
