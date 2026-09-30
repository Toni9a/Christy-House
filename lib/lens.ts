import "server-only";

/**
 * "Google Lens"-style visual lookups. Google has no official Lens API, so we
 * support two optional boosters and feed whatever they return to Claude as hints:
 *
 *  - Google Cloud Vision `WEB_DETECTION` (official): best-guess labels, entities and
 *    pages that contain visually matching images. Works with raw image bytes.
 *  - SerpApi `google_lens` (unofficial, paid): real Lens "visual matches", often with
 *    prices. Needs a publicly reachable image URL.
 *
 * With neither key set, Claude's own vision does the identifying — which is usually enough.
 */
export type LensHit = { title: string; url: string; source?: string; price?: string; thumbnail?: string };
const googleKey = () => process.env.GOOGLE_API_KEY || process.env.GOOGLE_VISION_API_KEY;
export const googleEnabled = () => Boolean(googleKey());
export type LensResult = { provider: string; labels: string[]; hits: LensHit[] };

export async function lensLookup(opts: { base64?: string; publicUrl?: string }): Promise<LensResult | null> {
  try {
    if (process.env.SERPAPI_KEY && opts.publicUrl) return await serpLens(opts.publicUrl);
    if (googleKey() && opts.base64) return await visionWeb(opts.base64);
  } catch (e) {
    console.warn("[lens] lookup failed, continuing with Claude vision only:", e);
  }
  return null;
}

export async function visionWeb(base64: string): Promise<LensResult & { similar: string[] }> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${googleKey()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: "WEB_DETECTION", maxResults: 15 }] }],
    }),
  });
  if (!res.ok) throw new Error(`Vision ${res.status}: ${await res.text()}`);
  const web = (await res.json()).responses?.[0]?.webDetection ?? {};
  return {
    provider: "google-vision",
    labels: [
      ...(web.bestGuessLabels ?? []).map((l: { label: string }) => l.label),
      ...(web.webEntities ?? []).filter((e: { description?: string }) => e.description).slice(0, 8).map((e: { description: string }) => e.description),
    ],
    hits: (web.pagesWithMatchingImages ?? []).slice(0, 12).map((p: { url: string; pageTitle?: string }) => ({
      title: (p.pageTitle ?? "").replace(/<[^>]+>/g, "") || new URL(p.url).hostname,
      url: p.url,
    })),
    similar: (web.visuallySimilarImages ?? []).slice(0, 8).map((i: { url: string }) => i.url),
  };
}

async function serpLens(imageUrl: string): Promise<LensResult> {
  const u = new URL("https://serpapi.com/search.json");
  u.searchParams.set("engine", "google_lens");
  u.searchParams.set("url", imageUrl);
  u.searchParams.set("api_key", process.env.SERPAPI_KEY!);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`SerpApi ${res.status}`);
  const data = await res.json();
  return {
    provider: "google-lens (serpapi)",
    labels: [],
    hits: (data.visual_matches ?? []).slice(0, 15).map((m: any) => ({
      title: m.title,
      url: m.link,
      source: m.source,
      price: m.price?.value,
      thumbnail: m.thumbnail,
    })),
  };
}

export function lensToPrompt(l: LensResult) {
  const lines = [`Visual search hints from ${l.provider} (may be noisy — verify):`];
  if (l.labels.length) lines.push(`Labels: ${l.labels.join(", ")}`);
  for (const h of l.hits) lines.push(`- ${h.title} ${h.price ? `(${h.price}) ` : ""}${h.url}`);
  return lines.join("\n");
}
