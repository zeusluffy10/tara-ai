// // mobile/utils/tts_job_client.ts
// import { playAudioUri } from "./tts_loud";

// const BASE = "https://tara-ai-backend-swbp.onrender.com";

// export async function startTtsJob(text: string, voice?: string, lang: string = "fil") {
//   const resp = await fetch(`${BASE}/tts`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ text, voice, lang }),
//   });

//   if (!resp.ok) {
//     throw new Error(`startTtsJob failed: ${resp.status} ${await resp.text()}`);
//   }

//   return resp.json(); // { job_id, status }
// }

// export async function getTtsStatus(jobId: string) {
//   const resp = await fetch(`${BASE}/tts/status/${jobId}`);
//   if (!resp.ok) throw new Error(`status call failed ${resp.status}`);
//   return resp.json();
// }

// /**
//  * Poll until done.
//  */
// export async function waitForTts(
//   jobId: string,
//   pollIntervalMs = 1500,
//   timeoutMs = 60000
// ) {
//   const start = Date.now();

//   while (true) {
//     const status = await getTtsStatus(jobId);

//     if (status.status === "done") return status;
//     if (status.status === "error") throw new Error(status.error || "tts job error");

//     if (Date.now() - start > timeoutMs) throw new Error("tts job timeout");

//     await new Promise((r) => setTimeout(r, pollIntervalMs));
//   }
// }

// /**
//  * ✅ Play the job result using the SINGLE audio engine (tts_loud.ts).
//  * No expo-av usage here.
//  */
// export async function playTtsJobResult(jobId: string) {
//   const url = `${BASE}/tts/result/${jobId}`;
//   return await playAudioUri(url);
// }
