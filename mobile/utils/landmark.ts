// mobile/utils/landmark.ts

const BACKEND_URL = "https://tara-ai-backend-swbp.onrender.com";
// ⚠️ replace with your real Render URL

export async function getLandmarkName(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/landmark?lat=${lat}&lng=${lng}`
    );

    if (!res.ok) {
      console.warn("Landmark backend HTTP error:", res.status);
      return null;
    }

    const data = await res.json();

    if (!data?.name) return null;

    return data.name;
  } catch (err) {
    console.warn("Landmark backend error:", err);
    return null;
  }
}
