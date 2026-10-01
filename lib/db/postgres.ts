import "server-only";
import postgres from "postgres";
import { get, put } from "@vercel/blob";
import type { Comment, Item, MeterReading, PhotoKind, Reaction, Room, RoomPhoto, Search } from "../types";
import { jsonStore } from "./json";
import { SCHEMA } from "./schema";
import type { Store } from "./types";
import { contentTypeOf, fileName, newId, STARTER_ROOMS } from "./util";

/**
 * The real site's store: Postgres (Neon, through Vercel) for the data and
 * Vercel Blob for photos and scans. Runs only on the server.
 */
const blobAccess = (process.env.BLOB_ACCESS === "public" ? "public" : "private") as "public" | "private";
/**
 * Without Blob configured (e.g. testing against a local database), files stay on local disk.
 * This specifically needs the real BLOB_READ_WRITE_TOKEN: uploads go straight from the
 * browser to Blob, which means minting a signed client token first — the newer
 * BLOB_STORE_ID + automatic OIDC auth covers server-side put()/get() calls, but not that.
 */
export const usingBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

type Sql = ReturnType<typeof postgres>;
let client: Sql | null = null;
let ready: Promise<void> | null = null;

async function db(): Promise<Sql> {
  // prepare:false keeps it compatible with Neon's pooled (pgbouncer) connection string.
  client ??= postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, idle_timeout: 20, onnotice: () => {} });
  ready ??= setUp(client).catch((e) => { ready = null; throw e; });
  await ready;
  return client;
}

/** Create the tables if needed and add the starter rooms the very first time. */
async function setUp(sql: Sql) {
  await sql.unsafe(SCHEMA);
  const [seeded] = await sql`select 1 from meta where key = 'seeded'`;
  if (seeded) return;
  const [{ count }] = await sql`select count(*)::int as count from rooms`;
  if (count === 0) {
    for (const [i, r] of STARTER_ROOMS.entries()) {
      await sql`insert into rooms (id, name, kind, created_at) values (${r.id}, ${r.name}, ${r.kind}, now() + ${i + " seconds"}::interval)
                on conflict (id) do nothing`;
    }
  }
  await sql`insert into meta (key, value) values ('seeded', 'yes') on conflict (key) do nothing`;
}

// ── Row ↔ object mapping (the database uses snake_case) ──────────────
type Row = Record<string, any>;
const num = (v: unknown) => (v == null ? null : Number(v));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

const toRoom = (r: Row): Room => ({ id: r.id, name: r.name, kind: r.kind, dims: r.dims, notes: r.notes, scanFile: r.scan_file, createdAt: iso(r.created_at) });
const roomCols = (r: Partial<Room>) => strip({ name: r.name, kind: r.kind, dims: r.dims, notes: r.notes, scan_file: r.scanFile });

const toItem = (r: Row): Item => ({
  id: r.id, roomId: r.room_id, title: r.title, status: r.status, price: num(r.price), currency: r.currency, url: r.url,
  source: r.source, image_url: r.image_url, width_cm: num(r.width_cm), depth_cm: num(r.depth_cm), height_cm: num(r.height_cm),
  condition: r.condition, match_score: Number(r.match_score), why: r.why, notes: r.notes, addedBy: r.added_by, addedAt: iso(r.added_at),
});
const itemCols = (i: Partial<Item>) => strip({
  room_id: i.roomId, title: i.title, status: i.status, price: i.price, currency: i.currency, url: i.url, source: i.source,
  image_url: i.image_url, width_cm: i.width_cm, depth_cm: i.depth_cm, height_cm: i.height_cm, condition: i.condition,
  match_score: i.match_score, why: i.why, notes: i.notes, added_by: i.addedBy,
});

const toPhoto = (r: Row): RoomPhoto => ({ id: r.id, roomId: r.room_id, file: r.file, caption: r.caption, kind: r.kind as PhotoKind, addedBy: r.added_by, addedAt: iso(r.added_at) });
const toMeter = (r: Row): MeterReading => ({
  id: r.id, meter: r.meter, label: r.label, reading: r.reading, unit: r.unit, photo: r.photo,
  takenOn: r.taken_on instanceof Date ? r.taken_on.toISOString().slice(0, 10) : String(r.taken_on).slice(0, 10),
  notes: r.notes, addedBy: r.added_by, addedAt: iso(r.added_at),
});
const toComment = (r: Row): Comment => ({ id: r.id, itemId: r.item_id, author: r.author, body: r.body, createdAt: iso(r.created_at) });
const toReaction = (r: Row): Reaction => ({ itemId: r.item_id, person: r.person, value: r.value });
const toSearch = (r: Row): Search => ({ ...r.data, id: r.id, createdAt: iso(r.created_at) });

/** Leave out undefined keys so a patch only touches what it names. */
function strip(o: Row) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

export const postgresStore: Store = {
  async listRooms() { const sql = await db(); return (await sql`select * from rooms order by created_at`).map(toRoom); },
  async getRoom(id) { const sql = await db(); const [r] = await sql`select * from rooms where id = ${id}`; return r ? toRoom(r) : null; },
  async createRoom(r) {
    const sql = await db();
    const [row] = await sql`insert into rooms ${sql({ id: newId(), ...roomCols(r), dims: sql.json(r.dims) })} returning *`;
    return toRoom(row);
  },
  async updateRoom(id, patch) {
    const sql = await db();
    const cols = roomCols(patch);
    if (cols.dims) cols.dims = sql.json(cols.dims);
    if (!Object.keys(cols).length) return postgresStore.getRoom(id);
    const [row] = await sql`update rooms set ${sql(cols)} where id = ${id} returning *`;
    return row ? toRoom(row) : null;
  },
  async deleteRoom(id) { const sql = await db(); await sql`delete from rooms where id = ${id}`; },

  async listItems(roomId) {
    const sql = await db();
    const rows = roomId === undefined
      ? await sql`select * from items order by added_at desc`
      : await sql`select * from items where room_id = ${roomId} order by added_at desc`;
    return rows.map(toItem);
  },
  async getItem(id) { const sql = await db(); const [r] = await sql`select * from items where id = ${id}`; return r ? toItem(r) : null; },
  async addItem(i) {
    const sql = await db();
    if (i.url) { // saving the same listing to the same room twice is a no-op
      const [dup] = await sql`select * from items where url = ${i.url} and room_id is not distinct from ${i.roomId} limit 1`;
      if (dup) return toItem(dup);
    }
    const [row] = await sql`insert into items ${sql({ id: newId(), ...itemCols(i) })} returning *`;
    return toItem(row);
  },
  async updateItem(id, patch) {
    const sql = await db();
    const cols = itemCols(patch);
    if (!Object.keys(cols).length) return postgresStore.getItem(id);
    const [row] = await sql`update items set ${sql(cols)} where id = ${id} returning *`;
    return row ? toItem(row) : null;
  },
  async deleteItem(id) { const sql = await db(); await sql`delete from items where id = ${id}`; },

  async listRoomPhotos(roomId, kind) {
    const sql = await db();
    const rows = kind
      ? await sql`select * from room_photos where room_id = ${roomId} and kind = ${kind} order by added_at desc`
      : await sql`select * from room_photos where room_id = ${roomId} order by added_at desc`;
    return rows.map(toPhoto);
  },
  async listPhotosByKind(kind) { const sql = await db(); return (await sql`select * from room_photos where kind = ${kind} order by added_at desc`).map(toPhoto); },
  async addRoomPhoto(p) {
    const sql = await db();
    const [row] = await sql`insert into room_photos (id, room_id, file, caption, kind, added_by) values (${newId()}, ${p.roomId}, ${p.file}, ${p.caption}, ${p.kind}, ${p.addedBy}) returning *`;
    return toPhoto(row);
  },
  async deleteRoomPhoto(id) { const sql = await db(); await sql`delete from room_photos where id = ${id}`; },

  async listMeterReadings() { const sql = await db(); return (await sql`select * from meter_readings order by taken_on desc, added_at desc`).map(toMeter); },
  async addMeterReading(m) {
    const sql = await db();
    const [row] = await sql`insert into meter_readings (id, meter, label, reading, unit, photo, taken_on, notes, added_by)
      values (${newId()}, ${m.meter}, ${m.label}, ${m.reading}, ${m.unit}, ${m.photo}, ${m.takenOn}, ${m.notes}, ${m.addedBy}) returning *`;
    return toMeter(row);
  },
  async deleteMeterReading(id) { const sql = await db(); await sql`delete from meter_readings where id = ${id}`; },

  async listComments(itemId) { const sql = await db(); return (await sql`select * from comments where item_id = ${itemId} order by created_at`).map(toComment); },
  async commentCounts() {
    const sql = await db();
    return Object.fromEntries((await sql`select item_id, count(*)::int as n from comments group by item_id`).map((r) => [r.item_id, r.n]));
  },
  async addComment(c) {
    const sql = await db();
    const [row] = await sql`insert into comments (id, item_id, author, body) values (${newId()}, ${c.itemId}, ${c.author}, ${c.body}) returning *`;
    return toComment(row);
  },
  async deleteComment(id) { const sql = await db(); await sql`delete from comments where id = ${id}`; },

  async listReactions() { const sql = await db(); return (await sql`select * from reactions`).map(toReaction); },
  async setReaction(itemId, person, value) {
    const sql = await db();
    if (value) await sql`insert into reactions (item_id, person, value) values (${itemId}, ${person}, ${value})
                         on conflict (item_id, person) do update set value = excluded.value, created_at = now()`;
    else await sql`delete from reactions where item_id = ${itemId} and person = ${person}`;
  },

  async listSearches(limit = 50) { const sql = await db(); return (await sql`select * from searches order by created_at desc limit ${limit}`).map(toSearch); },
  async getSearch(id) { const sql = await db(); const [r] = await sql`select * from searches where id = ${id}`; return r ? toSearch(r) : null; },
  async createSearch(s) {
    const sql = await db();
    const [row] = await sql`insert into searches (id, data) values (${newId()}, ${sql.json(s as any)}) returning *`;
    return toSearch(row);
  },
  async updateSearch(id, patch) {
    const sql = await db();
    const cur = await postgresStore.getSearch(id);
    if (!cur) return null;
    const { id: _id, createdAt: _c, ...data } = { ...cur, ...patch };
    const [row] = await sql`update searches set data = ${sql.json(data as any)} where id = ${id} returning *`;
    return toSearch(row);
  },

  async getSetting(key) { const sql = await db(); const [r] = await sql`select value from meta where key = ${"setting:" + key}`; return r?.value ?? null; },
  async setSetting(key, value) {
    const sql = await db();
    if (value == null) await sql`delete from meta where key = ${"setting:" + key}`;
    else await sql`insert into meta (key, value) values (${"setting:" + key}, ${value}) on conflict (key) do update set value = excluded.value`;
  },

  async putFile(data, ext, contentType) {
    if (!usingBlob()) return jsonStore.putFile(data, ext, contentType);
    const name = fileName(ext);
    await put(name, data, { access: blobAccess, contentType, addRandomSuffix: false });
    return name;
  },
  async getFile(name) {
    if (!usingBlob()) return jsonStore.getFile(name);
    const res = await get(name, { access: blobAccess }).catch(() => null);
    if (!res || res.statusCode !== 200) return null;
    return { data: Buffer.from(await new Response(res.stream).arrayBuffer()), contentType: res.blob.contentType || contentTypeOf(name) };
  },
};

/** Streams a file out of Blob without buffering it, so big scans stay under the function response limit. Null when Blob isn't in use. */
export async function streamBlob(name: string): Promise<{ stream: ReadableStream; contentType: string } | null | undefined> {
  if (!usingBlob()) return undefined;
  const res = await get(name, { access: blobAccess }).catch(() => null);
  if (!res || res.statusCode !== 200) return null;
  return { stream: res.stream, contentType: res.blob.contentType || contentTypeOf(name) };
}
