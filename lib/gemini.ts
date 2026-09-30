import "server-only";

type Img = { base64: string; mediaType: string };

export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

/**
 * "See it in my room" renders via Gemini image generation.
 * Uses the REST endpoint directly so there's no extra SDK to install.
 */
export async function visualize(opts: { room: Img; product: Img | null; productDesc: string }) {
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

  const parts: object[] = [
    {
      text:
        `Photorealistic interior edit. Place the following item into this room photo, at a believable scale, ` +
        `matching the room's lighting, perspective and shadows. Keep everything else in the room unchanged.\n` +
        `Item: ${opts.productDesc}` +
        (opts.product ? "\nThe second image shows the exact item." : ""),
    },
    { inline_data: { mime_type: opts.room.mediaType, data: opts.room.base64 } },
  ];
  if (opts.product) parts.push({ inline_data: { mime_type: opts.product.mediaType, data: opts.product.base64 } });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const out = (data.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData || p.inline_data);
  const inline = out?.inlineData ?? out?.inline_data;
  if (!inline) throw new Error("Gemini returned no image");
  return { base64: inline.data as string, mediaType: (inline.mimeType ?? inline.mime_type ?? "image/png") as string };
}

// ── Gemini Interactions API — shared by the product finder and the Google check ──
// One endpoint, text + images in, optionally grounded with a live Google Search.
const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

export type GeminiPart = { type: "text"; text: string } | { type: "image"; data: string; mime_type: string };

export async function callGemini(body: Record<string, unknown>) {
  const res = await fetch(INTERACTIONS_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data?.error?.message || text.slice(0, 300)}`);
  return data;
}

/** Pulls the model's final text out of whatever shape the response came back in. */
export function extractGeminiText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
  for (const step of data?.steps ?? []) {
    if (step?.type !== "model_output") continue;
    const text = (step.content ?? [])
      .filter((p: any) => typeof p?.text === "string")
      .map((p: any) => p.text)
      .join("");
    if (text.trim()) return text;
  }
  // Defensive fallback in case the classic generateContent shape comes back instead.
  const classic = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("");
  return classic || "";
}
