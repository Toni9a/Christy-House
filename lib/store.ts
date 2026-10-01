import "server-only";
import { jsonStore } from "./db/json";
import { postgresStore, usingBlob } from "./db/postgres";

/**
 * Postgres + Vercel Blob when DATABASE_URL is set (the real site), otherwise a
 * local JSON file so the app runs on your own computer with no setup.
 */
export const usingDatabase = Boolean(process.env.DATABASE_URL);
export const store = usingDatabase ? postgresStore : jsonStore;
/** Browsers upload straight to Vercel Blob when it is set up. */
export const directUploads = usingDatabase && usingBlob();

export const {
  listRooms, getRoom, createRoom, updateRoom, deleteRoom,
  listItems, getItem, addItem, updateItem, deleteItem,
  listRoomPhotos, listPhotosByKind, addRoomPhoto, deleteRoomPhoto,
  listMeterReadings, addMeterReading, deleteMeterReading,
  listComments, commentCounts, addComment, deleteComment,
  listReactions, setReaction,
  listSearches, getSearch, createSearch, updateSearch,
  getSetting, setSetting,
  putFile, getFile,
} = store;

/** Kept for existing callers: store a file and return its name. */
export const storeFile = (data: Buffer, ext: string, contentType = "application/octet-stream") => putFile(data, ext, contentType);
