import "server-only";
import { getSetting, setSetting } from "@/lib/store";
import type { TryRender, TryView } from "./types";

/** Calibrated room photos and recent renders live in settings as JSON, like floor plans and manuals. */
const VIEWS = "tryon_views", RENDERS = "tryon_renders", SKIPPED = "tryon_skipped";
const load = async <T,>(key: string): Promise<T[]> => { try { return JSON.parse((await getSetting(key)) ?? "[]"); } catch { return []; } };

export const loadViews = () => load<TryView>(VIEWS);
export const saveViews = (v: TryView[]) => setSetting(VIEWS, JSON.stringify(v));
export const loadRenders = () => load<TryRender>(RENDERS);
/** Newest first; keeps the last 60 so the setting stays small. */
export const addRender = async (r: TryRender) => setSetting(RENDERS, JSON.stringify([r, ...(await loadRenders())].slice(0, 60)));
export const saveRenders = (r: TryRender[]) => setSetting(RENDERS, JSON.stringify(r));

/** Stored file names are short random names with an extension. */
export const FILE_RE = /^[\w-]{6,40}\.(jpe?g|png|webp)$/i;

/** Photos that could not be lined up with the plan (close-ups, meter cupboards): not tried again automatically. */
export const loadSkipped = () => load<string>(SKIPPED);
export const skipPhoto = async (file: string) => setSetting(SKIPPED, JSON.stringify([...new Set([...(await loadSkipped()), file])].slice(-200)));
