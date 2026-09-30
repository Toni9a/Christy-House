import "server-only";

type Img = { base64: string; mediaType: string };

/**
 * Optional: "see it in my room" renders via Gemini image generation.
 * Uses the REST endpoint directly so there's no extra SDK to install.
 */
export async function visualize(opts: { room: Img; product: Img | null; productDesc: string }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
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
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const out = (data.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData || p.inline_data);
  const inline = out?.inlineData ?? out?.inline_data;
  if (!inline) throw new Error("Gemini returned no image");
  return { base64: inline.data as string, mediaType: (inline.mimeType ?? inline.mime_type ?? "image/png") as string };
}
