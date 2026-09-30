import "server-only";
import { commentCounts, listReactions } from "./store";
import type { ItemSocial } from "./types";

/** Loves, "not for me"s and comment counts for every item, keyed by item id. */
export async function getSocial(): Promise<Record<string, ItemSocial>> {
  const [reactions, counts] = await Promise.all([listReactions(), commentCounts()]);
  const out: Record<string, ItemSocial> = {};
  const slot = (id: string) => (out[id] ??= { reactions: [], comments: 0 });
  for (const r of reactions) slot(r.itemId).reactions.push(r);
  for (const [id, n] of Object.entries(counts)) slot(id).comments = n;
  return out;
}

/** The newest photo of each room, used as its cover. */
export async function getRoomCovers(roomIds: string[]): Promise<Record<string, string>> {
  const { listRoomPhotos } = await import("./store");
  const firsts = await Promise.all(roomIds.map(async (id) => [id, (await listRoomPhotos(id))[0]?.file] as const));
  return Object.fromEntries(firsts.filter(([, f]) => f).map(([id, f]) => [id, `/api/files/${f}`]));
}
