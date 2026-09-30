import "server-only";
import { findProducts, type FindInput } from "./finder";
import { createSearch, getRoom, updateSearch } from "./store";
import type { Filters, SearchChannel } from "./types";

/** Records a search, runs the finder, and stores the outcome. Shared by the web UI and SMS. */
export async function startSearch(args: {
  channel: SearchChannel;
  query: string;
  link: string | null;
  image: FindInput["image"];
  imageFile: string | null;
  filters: Filters;
}) {
  const search = await createSearch({
    channel: args.channel,
    status: "running",
    query: args.query,
    link: args.link,
    imageFile: args.imageFile,
    filters: args.filters,
    identified: null,
    summary: null,
    products: [],
    error: null,
  });

  const run = async () => {
    try {
      const room = args.filters.roomId ? await getRoom(args.filters.roomId) : null;
      const out = await findProducts({ query: args.query, link: args.link, image: args.image, filters: args.filters, room });
      return await updateSearch(search.id, { status: "done", ...out });
    } catch (e) {
      console.error("[search]", e);
      return await updateSearch(search.id, { status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  return { search, run };
}

export const defaultFilters = (): Filters => ({
  minPrice: 0,
  maxPrice: 1000,
  maxWidth: null,
  closeness: 60,
  condition: "any",
  sources: ["anywhere"],
  roomId: null,
});
