
// @ts-ignore
import polyline from "@mapbox/polyline";

export type LatLng = { latitude: number; longitude: number };

/**
 * Decode a Google/Mapbox-style encoded polyline string to array of {latitude, longitude}.
 */
export default function decodePolyline(encoded: string): LatLng[] {
  try {
    const pts = polyline.decode(encoded); // returns [ [lat, lng], ... ]
    return pts.map((p: number[]) => ({ latitude: p[0], longitude: p[1] }));
  } catch (err) {
    console.warn("Failed to decode polyline", err);
    return [];
  }
}
