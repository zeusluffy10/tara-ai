
export type Landmark = {
  name: string;
  distance: number;
};

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const LANDMARK_TYPES = [
  "restaurant",
  "school",
  "church",
  "local_government_office",
  "store",
];

export async function findNearbyLandmark(
  lat: number,
  lng: number
): Promise<Landmark | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&radius=40` +
      `&type=${LANDMARK_TYPES.join("|")}` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.results?.length) return null;

    return { name: data.results[0].name, distance: 0 };
  } catch {
    return null;
  }
}

export async function getLandmarkName(
  lat: number,
  lng: number
): Promise<string | null> {
  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!API_KEY) {
    console.warn("GOOGLE MAPS API KEY MISSING");
    throw new Error("API_KEY_MISSING");
  }

  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}` +
    `&radius=40` +
    `&type=store|school|church|restaurant` +
    `&key=${API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") {
    throw new Error(
      `Places API error: ${data.status} - ${data.error_message ?? ""}`
    );
  }

  if (!data.results?.length) {
    throw new Error("ZERO_RESULTS");
  }

  return data.results[0].name;
}

