import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Comment, Item, MeterReading, Reaction, Room, RoomPhoto, Search } from "../types";
import type { Store } from "./types";
import { contentTypeOf, fileName, newId, STARTER_ROOMS } from "./util";

/** Local development store: one JSON file plus an uploads folder under .data/. */
// On Vercel the app folder is read-only, so without a database fall back to /tmp.
// That keeps the site working, but anything saved there is wiped regularly.
const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/house-data" : path.join(process.cwd(), ".data"));
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

type DB = {
  rooms: Room[]; items: Item[]; roomPhotos: RoomPhoto[]; meterReadings: MeterReading[]; settings: Record<string, string>; comments: Comment[]; reactions: Reaction[]; searches: Search[];
  seeded?: boolean;
};
const empty = (): DB => ({ rooms: [], items: [], roomPhotos: [], meterReadings: [], settings: {}, comments: [], reactions: [], searches: [] });

let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<DB> {
  let db: DB & { saved?: Item[] };
  try {
    db = { ...empty(), ...JSON.parse(await fs.readFile(DB_FILE, "utf8")) };
  } catch {
    db = empty();
  }
  let changed = false;
  if (db.saved) { // older data kept a "saved" shortlist
    db.items.push(...db.saved.map((s) => ({ ...s, status: s.status ?? "idea", notes: s.notes ?? "", addedBy: null, addedAt: s.addedAt ?? new Date().toISOString() })));
    delete db.saved;
    changed = true;
  }
  if (!db.seeded) {
    if (!db.rooms.length) {
      db.rooms = STARTER_ROOMS.map((r, i) => ({
        ...r, notes: "", scanFile: null, dims: { width: null, depth: null, height: null },
        createdAt: new Date(Date.now() + i).toISOString(),
      }));
    }
    db.seeded = true;
    changed = true;
  }
  if (changed) await write(db); // so seeded ids stay stable across requests
  return db;
}

async function write(db: DB) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

// Serialise writes so concurrent requests don't clobber each other.
function mutate<T>(fn: (db: DB) => T): Promise<T> {
  const run = queue.then(async () => {
    const db = await read();
    const out = fn(db);
    await write(db);
    return out;
  });
  queue = run.catch(() => {});
  return run;
}

const now = () => new Date().toISOString();
const byNewest = <T>(key: keyof T) => (a: T, b: T) => String(b[key]).localeCompare(String(a[key]));
function patchOne<T extends { id: string }>(list: T[], id: string, patch: Partial<T>) {
  const x = list.find((i) => i.id === id);
  if (x) Object.assign(x, patch, { id });
  return x ?? null;
}

export const jsonStore: Store = {
  listRooms: async () => (await read()).rooms.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  getRoom: async (id) => (await read()).rooms.find((r) => r.id === id) ?? null,
  createRoom: (r) => mutate((db) => { const room = { ...r, id: newId(), createdAt: now() }; db.rooms.push(room); return room; }),
  updateRoom: (id, patch) => mutate((db) => patchOne(db.rooms, id, patch)),
  deleteRoom: (id) => mutate((db) => {
    db.rooms = db.rooms.filter((r) => r.id !== id);
    db.roomPhotos = db.roomPhotos.filter((p) => p.roomId !== id);
    for (const it of db.items) if (it.roomId === id) it.roomId = null; // keep the items, unassigned
  }),

  listItems: async (roomId) => {
    const items = (await read()).items.slice().sort(byNewest("addedAt"));
    return roomId === undefined ? items : items.filter((i) => i.roomId === roomId);
  },
  getItem: async (id) => (await read()).items.find((i) => i.id === id) ?? null,
  addItem: (i) => mutate((db) => {
    // Saving the same listing to the same room twice is a no-op.
    const dup = i.url && db.items.find((x) => x.url === i.url && x.roomId === i.roomId);
    if (dup) return dup;
    const item = { ...i, id: newId(), addedAt: now() };
    db.items.push(item);
    return item;
  }),
  updateItem: (id, patch) => mutate((db) => patchOne(db.items, id, patch)),
  deleteItem: (id) => mutate((db) => {
    db.items = db.items.filter((x) => x.id !== id);
    db.comments = db.comments.filter((c) => c.itemId !== id);
    db.reactions = db.reactions.filter((r) => r.itemId !== id);
  }),

  // Photos saved before "kind" existed count as "now".
  listRoomPhotos: async (roomId, kind) => (await read()).roomPhotos.filter((p) => p.roomId === roomId && (!kind || (p.kind ?? "now") === kind)).sort(byNewest("addedAt")),
  listPhotosByKind: async (kind) => (await read()).roomPhotos.filter((p) => (p.kind ?? "now") === kind).sort(byNewest("addedAt")),
  addRoomPhoto: (p) => mutate((db) => { const photo = { ...p, id: newId(), addedAt: now() }; db.roomPhotos.push(photo); return photo; }),
  deleteRoomPhoto: (id) => mutate((db) => { db.roomPhotos = db.roomPhotos.filter((p) => p.id !== id); }),

  listMeterReadings: async () => (await read()).meterReadings.slice().sort((a, b) => b.takenOn.localeCompare(a.takenOn) || b.addedAt.localeCompare(a.addedAt)),
  addMeterReading: (m) => mutate((db) => { const r = { ...m, id: newId(), addedAt: now() }; db.meterReadings.push(r); return r; }),
  deleteMeterReading: (id) => mutate((db) => { db.meterReadings = db.meterReadings.filter((m) => m.id !== id); }),

  listComments: async (itemId) => (await read()).comments.filter((c) => c.itemId === itemId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  commentCounts: async () => {
    const out: Record<string, number> = {};
    for (const c of (await read()).comments) out[c.itemId] = (out[c.itemId] ?? 0) + 1;
    return out;
  },
  addComment: (c) => mutate((db) => { const comment = { ...c, id: newId(), createdAt: now() }; db.comments.push(comment); return comment; }),
  deleteComment: (id) => mutate((db) => { db.comments = db.comments.filter((c) => c.id !== id); }),

  listReactions: async () => (await read()).reactions,
  setReaction: (itemId, person, value) => mutate((db) => {
    db.reactions = db.reactions.filter((r) => !(r.itemId === itemId && r.person === person));
    if (value) db.reactions.push({ itemId, person, value });
  }),

  listSearches: async (limit = 50) => (await read()).searches.slice().sort(byNewest("createdAt")).slice(0, limit),
  getSearch: async (id) => (await read()).searches.find((s) => s.id === id) ?? null,
  createSearch: (s) => mutate((db) => { const out = { ...s, id: newId(), createdAt: now() }; db.searches.push(out); return out; }),
  updateSearch: (id, patch) => mutate((db) => patchOne(db.searches, id, patch)),

  getSetting: async (key) => (await read()).settings[key] ?? null,
  setSetting: (key, value) => mutate((db) => { if (value == null) delete db.settings[key]; else db.settings[key] = value; }),

  async putFile(data, ext) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const name = fileName(ext);
    await fs.writeFile(path.join(UPLOAD_DIR, name), data);
    return name;
  },
  async getFile(name) {
    try {
      return { data: await fs.readFile(path.join(UPLOAD_DIR, path.basename(name))), contentType: contentTypeOf(name) };
    } catch {
      return null;
    }
  },
};

/** Local-only: write an upload that came through the app (see /api/uploads/[name]). */
export async function writeLocalUpload(name: string, data: Buffer) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, path.basename(name)), data);
}
