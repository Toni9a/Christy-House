import { after } from "next/server";
import { config, money } from "@/lib/config";
import { filtersFromText, firstUrl } from "@/lib/parse-text";
import { defaultFilters, startSearch } from "@/lib/run-search";
import { listRooms, storeFile } from "@/lib/store";
import { fetchMedia, isAllowedSender, sendMessage, twiml, validSignature } from "@/lib/twilio";

export const maxDuration = 300;

/**
 * Twilio webhook for SMS / MMS / WhatsApp. Point your number's "A message comes in"
 * webhook at  {PUBLIC_BASE_URL}/api/sms  (HTTP POST).
 *
 * Twilio gives webhooks ~15s, but a proper search takes longer — so we reply
 * "on it" straight away and text the results when they're ready.
 */
export async function POST(req: Request) {
  const params = Object.fromEntries(new URLSearchParams(await req.text())) as Record<string, string>;
  const url = `${config.baseUrl}/api/sms`;
  if (!validSignature(url, params, req.headers.get("x-twilio-signature"))) return new Response("Forbidden", { status: 403 });

  const from = params.From ?? "";
  if (!isAllowedSender(from)) return twiml(); // silently ignore strangers — they'd be spending your API credit

  const text = (params.Body ?? "").trim();
  if (/^(help|\?)$/i.test(text)) {
    return twiml(`Send a photo or link + what you want, e.g. "like this but under £600 for the living room, second hand ok". Portal: ${config.baseUrl}`);
  }

  const mediaUrl = Number(params.NumMedia ?? 0) > 0 && params.MediaContentType0?.startsWith("image/") ? params.MediaUrl0 : null;
  const link = firstUrl(text);
  const query = link ? text.replace(link, "").trim() : text;
  if (!mediaUrl && !link && !query) return twiml("Send me a photo, a link, or tell me what you're after.");

  const filters = filtersFromText(text, await listRooms(), { ...defaultFilters(), maxPrice: 1500 });

  after(async () => {
    let image = null, imageFile = null;
    if (mediaUrl) {
      const media = await fetchMedia(mediaUrl);
      imageFile = await storeFile(Buffer.from(media.base64, "base64"), media.mediaType.split("/")[1] || "jpg", media.mediaType);
      image = { ...media, publicUrl: `${config.baseUrl}/api/files/${imageFile}` };
    }
    const { search, run } = await startSearch({ channel: "sms", query, link, image, imageFile, filters });
    const done = await run();
    const page = `${config.baseUrl}/find/${search.id}`;

    if (!done || done.status === "error" || !done.products.length) {
      return sendMessage(from, `Couldn't find good matches this time${done?.error ? ` (${done.error})` : ""}. Try loosening the budget? ${page}`, params.To);
    }
    const top = done.products.slice(0, 3).map((p, i) => `${i + 1}. ${p.title} — ${money(p.price, p.currency)} (${p.source})\n${p.url}`);
    await sendMessage(from, [`${done.identified?.name ?? "Found some"}:`, ...top, `All ${done.products.length}: ${page}`].join("\n\n"), params.To);
  });

  return twiml(`On it 🔎 ${money(filters.minPrice)}–${money(filters.maxPrice)}. I'll text you back in a minute or two.`);
}
