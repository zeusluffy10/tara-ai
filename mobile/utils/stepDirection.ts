export function normalizeDirection(instruction: string) {
  const text = instruction.toLowerCase();

  if (text.includes("left")) return "Kaliwa";
  if (text.includes("right")) return "Kanan";
  if (text.includes("u-turn")) return "Mag U-turn";
  if (text.includes("straight")) return "Diretso";

  return "Magpatuloy";
}
