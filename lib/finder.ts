import "server-only";
import { z } from "zod";
import { config } from "./config";
import { callGemini, extractGeminiText, type GeminiPart } from "./gemini";
import { SOURCES } from "./sources";
import type { Filters, Identified, Product, Room } from "./types";

export type FindInput = {
  query: string;
  link: string | null;
  image: { base64: string; mediaType: string; publicUrl?: string } | null;
  filters: Filters;
  room: Room | null;
};

export type FindOutput = { identified: Identified; summary: string; products: Product[] };

// ── Output contract: Gemini must answer with exactly this shape ──────────────
const ProductSchema = z.object({
  title: z.string(),
  price: z.number().nullable(),
  currency: z.string(),
  url: z.string(),
  source: z.string(),
  image_url: z.string().nullable(),
  width_cm: z.number().nullable(),
  depth_cm: z.number().nullable(),
  height_cm: z.number().nullable(),
  condition: z.enum(["new", "used", "unknown"]),
  match_score: z.number(),
  why: z.string(),
});
const ResultSchema = z.object({
  identified: z.object({
    name: z.string(),
    category: z.string(),
    style: z.string(),
    materials: z.array(z.string()),
    colors: z.array(z.string()),
    search_terms: z.array(z.string()),
  }),
  summary: z.string(),
  products: z.array(ProductSchema),
});

// Gemini's structured-output dialect: JSON Schema with type-array nulls (not OpenAPI "nullable").
const num = { type: ["number", "null"] } as const;
const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["identified", "summary", "products"],
  properties: {
    identified: {
      type: "object",
      additionalProperties: false,
      required: ["name", "category", "style", "materials", "colors", "search_terms"],
      properties: {
        name: { ...str, description: "What the reference item is, e.g. 'Boucle curved 3-seater sofa'" },
        category: { ...str, description: "sofa, bed, bedding, rug, table, lamp, chair, storage, decor…" },
        style: str,
        materials: strArr,
        colors: strArr,
        search_terms: { ...strArr, description: "3-5 short queries a human would type into a shop search box" },
      },
    },
    summary: { ...str, description: "Two sentences max: what you looked for and the standout pick." },
    products: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "price", "currency", "url", "source", "image_url", "width_cm", "depth_cm", "height_cm", "condition", "match_score", "why"],
        properties: {
          title: str,
          price: { ...num, description: "Current price as a number, no symbol" },
          currency: { ...str, description: "ISO code, e.g. GBP" },
          url: { ...str, description: "Direct product/listing URL you actually saw in search results — never invented" },
          source: { ...str, description: "Retailer or marketplace name" },
          image_url: { type: ["string", "null"], description: "Direct image URL if you saw one, else null" },
          width_cm: num,
          depth_cm: num,
          height_cm: num,
          condition: { type: "string", enum: ["new", "used", "unknown"] },
          match_score: { type: "number", description: "0-100 visual/functional similarity to the reference" },
          why: { ...str, description: "One short line on why it matches (or how it differs)" },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are the shopping brain of a personal home portal. The owner sends you a photo, a product link, and/or a description of something for their house (sofas, bedding, rugs, tables, lighting, storage, decor…). Your job: work out exactly what the item is, then find real, currently-available products that match it within their constraints.

How to work:
1. Identify the reference item: category, silhouette, materials, colours, style, and any brand/model if recognisable. If you were given a link, open it first to read the real product details and price.
2. Search the web for matches. Prefer direct product pages over listicles. Search several retailers — including second-hand marketplaces when allowed — and vary your queries (style words, materials, "dupe", "similar to <brand model>").
3. Respect the budget and size limits strictly. Anything outside them is excluded, not flagged.
4. Only include URLs you actually saw in search results. Never invent products, prices, URLs or dimensions — use null when unknown.
5. Aim for 6–12 strong results, sorted best first, with a spread of price points inside the budget.
6. Answer with the required JSON only. No prose outside it.`;

function buildBrief(input: FindInput) {
  const f = input.filters;
  const sources = f.sources.length === 0 || f.sources.includes("anywhere")
    ? "any reputable retailer or marketplace"
    : f.sources.map((id) => SOURCES.find((s) => s.id === id)?.label ?? id).join(", ");
  const closeness =
    f.closeness >= 75 ? "as close to an exact dupe as possible — same shape, material and colour"
    : f.closeness >= 40 ? "clearly similar: same silhouette and material family; colour can vary"
    : "same overall vibe and function; be creative with alternatives";

  const lines = [
    `Location: ${config.city}, ${config.country}. Prices in ${config.currency}.`,
    `Budget: ${f.minPrice}–${f.maxPrice} ${config.currency}.`,
    `Condition: ${f.condition === "any" ? "new or second-hand" : f.condition === "used" ? "second-hand only" : "new only"}.`,
    `Where to look: ${sources}.`,
    `How close: ${closeness}.`,
  ];
  if (f.maxWidth) lines.push(`Max width: ${f.maxWidth} cm (must physically fit).`);
  if (input.room) {
    const d = input.room.dims;
    lines.push(
      `It's for the ${input.room.name} (${input.room.kind})` +
        (d.width && d.depth ? `, room is ${d.width}×${d.depth} cm${d.height ? `, ceiling ${d.height} cm` : ""}` : "") +
        (input.room.notes ? `. Notes: ${input.room.notes}` : "") + ".",
    );
  }
  if (input.link) lines.push(`Reference link: ${input.link}`);
  if (input.query) lines.push(`What they said: "${input.query}"`);
  if (input.image) lines.push("A reference photo is attached.");
  return lines.join("\n");
}

const MODEL = process.env.GEMINI_SEARCH_MODEL || "gemini-3.5-flash";

function parseResult(text: string): FindOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini's response wasn't valid JSON.");
  }
  const result = ResultSchema.safeParse(parsed);
  if (!result.success) throw new Error("Result didn't match the expected shape: " + result.error.message);
  return result.data;
}

export async function findProducts(input: FindInput): Promise<FindOutput> {
  // Gemini reads the photo directly — no separate vision-lookup pass needed first.
  const parts: GeminiPart[] = [];
  if (input.image) parts.push({ type: "image", data: input.image.base64, mime_type: input.image.mediaType });
  parts.push({ type: "text", text: buildBrief(input) });

  const tools = [{ type: "google_search" }, { type: "url_context" }];
  const responseFormat = { type: "text", mime_type: "application/json", schema: RESPONSE_SCHEMA };

  // One call: search, read pages, and answer in the required JSON shape.
  const first = await callGemini({ model: MODEL, system_instruction: SYSTEM, input: parts, tools, response_format: responseFormat });
  let text = extractGeminiText(first);

  if (!text.trim()) {
    // Some models can't combine tools with structured output in one go — fall back to
    // two calls: gather grounded findings first, then ask for the JSON from those notes.
    const gather = await callGemini({ model: MODEL, system_instruction: SYSTEM, input: parts, tools });
    const findings = extractGeminiText(gather);
    if (!findings.trim()) throw new Error("Gemini didn't return anything. Try again, or narrow the search.");

    const structured = await callGemini({
      model: MODEL,
      system_instruction: "Turn the research notes into the required JSON shape. Use only URLs, prices and sizes that appear in the notes.",
      input: [{ type: "text", text: findings }],
      response_format: responseFormat,
    });
    text = extractGeminiText(structured);
    if (!text.trim()) throw new Error("Couldn't get a structured result from Gemini.");
  }

  const out = parseResult(text);
  return { ...out, products: postFilter(out.products, input.filters) };
}

/** Belt and braces: enforce the hard constraints ourselves too. */
function postFilter(products: Product[], f: Filters) {
  return products
    .filter((p) => /^https?:\/\//.test(p.url))
    .filter((p) => p.price == null || (p.price >= f.minPrice * 0.95 && p.price <= f.maxPrice * 1.05))
    .filter((p) => !f.maxWidth || p.width_cm == null || p.width_cm <= f.maxWidth)
    .filter((p) => !(f.condition === "new" && p.condition === "used"))
    .filter((p) => !(f.condition === "used" && p.condition === "new"))
    .sort((a, b) => b.match_score - a.match_score);
}
