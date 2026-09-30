import type { Filters, Room } from "./types";

/**
 * Pulls hard filters out of a casual text like
 * "grey boucle couch for the living room under £900, second hand ok".
 * Anything we don't catch here still reaches Claude verbatim.
 */
export function filtersFromText(text: string, rooms: Room[], base: Filters): Filters {
  const f = { ...base };
  const t = text.toLowerCase();
  const n = (s: string) => Number(s.replace(/[,k]/g, "")) * (s.endsWith("k") ? 1000 : 1);

  const range = t.match(/[£$€]?\s?(\d[\d,]*k?)\s?(?:-|to|–)\s?[£$€]?\s?(\d[\d,]*k?)/);
  const under = t.match(/(?:under|below|max|less than|up to|<)\s?[£$€]?\s?(\d[\d,]*k?)/);
  const around = t.match(/(?:around|about|~)\s?[£$€]?\s?(\d[\d,]*k?)/);
  // Ignore small ranges like "2-3 seater".
  if (range && n(range[2]) >= 20) [f.minPrice, f.maxPrice] = [n(range[1]), n(range[2])];
  else if (under) [f.minPrice, f.maxPrice] = [0, n(under[1])];
  else if (around) [f.minPrice, f.maxPrice] = [Math.round(n(around[1]) * 0.7), Math.round(n(around[1]) * 1.2)];

  if (/second.?hand|used|pre.?loved|marketplace|gumtree/.test(t)) f.condition = /only/.test(t) ? "used" : "any";
  if (/brand new|new only/.test(t)) f.condition = "new";
  if (/exact|dupe|identical|same one/.test(t)) f.closeness = 90;
  if (/vibe|similar feel|inspired/.test(t)) f.closeness = 30;

  if (/amazon/.test(t)) f.sources = ["amazon"];
  if (/facebook|marketplace/.test(t)) f.sources = [...f.sources.filter((s) => s !== "anywhere"), "marketplace"];

  const room = rooms.find((r) => t.includes(r.name.toLowerCase()));
  if (room) f.roomId = room.id; // Claude reasons about fit from the room's dimensions
  return f;
}

export const firstUrl = (text: string) => text.match(/https?:\/\/\S+/)?.[0] ?? null;
