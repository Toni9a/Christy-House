import type { Comment, Item, MeterReading, PhotoKind, Reaction, ReactionValue, Room, RoomPhoto, Search } from "../types";

type New<T, K extends keyof T = never> = Omit<T, "id" | K>;

/**
 * Everything the app reads and writes. Two implementations:
 * a JSON file for running locally with no setup, and Supabase for the real site.
 */
export interface Store {
  listRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room | null>;
  createRoom(r: New<Room, "createdAt">): Promise<Room>;
  updateRoom(id: string, patch: Partial<Room>): Promise<Room | null>;
  deleteRoom(id: string): Promise<void>;

  listItems(roomId?: string): Promise<Item[]>;
  getItem(id: string): Promise<Item | null>;
  addItem(i: New<Item, "addedAt">): Promise<Item>;
  updateItem(id: string, patch: Partial<Item>): Promise<Item | null>;
  deleteItem(id: string): Promise<void>;

  /** A room's photos, newest first; `kind` narrows to "now" or "movein" photos. */
  listRoomPhotos(roomId: string, kind?: PhotoKind): Promise<RoomPhoto[]>;
  /** Every photo of one kind across all rooms. */
  listPhotosByKind(kind: PhotoKind): Promise<RoomPhoto[]>;
  addRoomPhoto(p: New<RoomPhoto, "addedAt">): Promise<RoomPhoto>;
  deleteRoomPhoto(id: string): Promise<void>;

  listMeterReadings(): Promise<MeterReading[]>;
  addMeterReading(m: New<MeterReading, "addedAt">): Promise<MeterReading>;
  deleteMeterReading(id: string): Promise<void>;

  listComments(itemId: string): Promise<Comment[]>;
  commentCounts(): Promise<Record<string, number>>;
  addComment(c: New<Comment, "createdAt">): Promise<Comment>;
  deleteComment(id: string): Promise<void>;

  listReactions(): Promise<Reaction[]>;
  setReaction(itemId: string, person: string, value: ReactionValue | null): Promise<void>;

  listSearches(limit?: number): Promise<Search[]>;
  getSearch(id: string): Promise<Search | null>;
  createSearch(s: New<Search, "createdAt">): Promise<Search>;
  updateSearch(id: string, patch: Partial<Search>): Promise<Search | null>;

  /** Small house-wide values, e.g. the whole-house scan's file name. */
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string | null): Promise<void>;

  /** Saves a file and returns its name. */
  putFile(data: Buffer, ext: string, contentType: string): Promise<string>;
  getFile(name: string): Promise<{ data: Buffer; contentType: string } | null>;
}
