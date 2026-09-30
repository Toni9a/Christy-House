import "server-only";
import { callGemini, extractGeminiText } from "./gemini";

/**
 * "Where is this from?" — one Gemini key does the whole job: it looks at the
 * photo, searches the web, and says what it thinks the item is and where it
 * saw it. The model writes the source pages into the JSON itself — when a
 * response is schema-constrained like this, Gemini doesn't attach the usual
 * search-citation annotations, so asking for them directly is what works.
 */
export type LensHit = { title: string; url: string };
export type LensResult = { labels: string[]; hits: LensHit[] };

const MODEL = process.env.GEMINI_SEARCH_MODEL || "gemini-3.5-flash";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["labels", "hits"],
  properties: {
    labels: { type: "array", items: { type: "string" }, description: "2-4 short phrases naming what the item is, best guess first" },
    hits: {
      type: "array",
      description: "Real pages you found in search results that show or sell this item, best match first",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: {
          title: { type: "string", description: "Page or shop name" },
          url: { type: "string", description: "The exact URL you saw in search results" },
        },
      },
    },
  },
} as const;

export async function identifySource(base64: string, mediaType: string): Promise<LensResult> {
  const data = await callGemini({
    model: MODEL,
    system_instruction: "Identify the item in the photo, then search the web for real pages that show it or sell it. Answer with the required JSON only.",
    input: [
      { type: "image", data: base64, mime_type: mediaType },
      { type: "text", text: "What is this, and where can I find it online?" },
    ],
    tools: [{ type: "google_search" }],
    response_format: { type: "text", mime_type: "application/json", schema: SCHEMA },
  });

  try {
    const parsed = JSON.parse(extractGeminiText(data));
    return {
      labels: Array.isArray(parsed?.labels) ? parsed.labels : [],
      hits: Array.isArray(parsed?.hits) ? parsed.hits.filter((h: any) => h?.url) : [],
    };
  } catch {
    return { labels: [], hits: [] };
  }
}
