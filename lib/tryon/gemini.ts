import "server-only";
import sharp from "sharp";

/** Gemini calls used by "Try it in the room". REST, like lib/gemini.ts, so there is no SDK to install. */
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Product shot = the hard step (re-angling the real product into the pose guide): Pro follows the guide far better.
// Harmonising light on an already-placed item is easy: Flash does it as well, faster and cheaper.
export const PLATE_MODEL = process.env.TRYON_PLATE_MODEL || "gemini-3-pro-image";
export const HARMONISE_MODEL = process.env.TRYON_HARMONISE_MODEL || "gemini-3.1-flash-image";
export const VISION_MODEL = process.env.TRYON_VISION_MODEL || "gemini-3.5-flash";

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY is not set");
  return k;
}

export const imagePart = async (buf: Buffer, max = 2000) => ({
  inline_data: { mime_type: "image/jpeg", data: (await sharp(buf).rotate().resize(max, max, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer()).toString("base64") },
});

async function call(model: string, body: object) {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key() }, body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export async function askJson<T = any>(prompt: string, images: Buffer[]): Promise<T> {
  const parts = [{ text: prompt }, ...(await Promise.all(images.map((b) => imagePart(b))))];
  const data = await call(VISION_MODEL, { contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } });
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  return JSON.parse(text);
}

const RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
export const nearestRatio = (r: number) =>
  RATIOS.reduce((best, s) => { const [a, b] = s.split(":").map(Number); const [c, d] = best.split(":").map(Number); return Math.abs(Math.log(a / b / r)) < Math.abs(Math.log(c / d / r)) ? s : best; });

export async function generateImage(model: string, parts: object[], aspectRatio: string, imageSize: "1K" | "2K" = "2K") {
  const data = await call(model, { contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio, imageSize } } });
  const out = (data.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData || p.inline_data);
  const inline = out?.inlineData ?? out?.inline_data;
  if (!inline) throw new Error(`Gemini (${model}) returned no image${data.candidates?.[0]?.finishReason ? `: ${data.candidates[0].finishReason}` : ""}`);
  return Buffer.from(inline.data, "base64");
}

/** Gemini boxes are [ymin, xmin, ymax, xmax] on 0-1000; answers sometimes come as a bare array or a list. */
export function readBox(j: any): [number, number, number, number] | null {
  const b = Array.isArray(j) ? (Array.isArray(j[0]) ? j[0] : j[0]?.box_2d ?? (typeof j[0] === "number" ? j : null)) : j?.box_2d;
  return Array.isArray(b) && b.length === 4 ? (b.map(Number) as [number, number, number, number]) : null;
}
