const API_BASE = "https://lying-liable-wales-led.trycloudflare.com";
export default API_BASE; // process.env.EXPO_PUBLIC_API_BASE || "http://192.168.110.210:8000";

export async function getJSON<T = any>(path: string): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : API_BASE + path;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

export async function postMultipart(path: string, formData: FormData): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : API_BASE + path;

  return fetch(url, {
    method: "POST",
    body: formData,
  });
}

export { API_BASE };
