export function handleRouteError(errorJson: any): string {
  if (!errorJson) return "Hindi ako makakuha ng ruta ngayon.";

  switch (errorJson.code) {
    case "NO_ROUTE":
      return "Walang makita na ruta papunta doon. Baka sarado ang daan.";
    case "INVALID_INPUT":
      return "May kulang na impormasyon. Ulitin natin.";
    case "INTERNAL_ROUTE_ERROR":
      return "Nagka-error ako sa pagkuha ng ruta. Subukan ulit.";
    default:
      return "Hindi ko makuha ang ruta. Subukan ulit.";
  }
}
