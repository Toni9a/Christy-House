import "server-only";
import { getSetting, setSetting } from "./store";
import type { Manual } from "./manuals-types";

const KEY = "manuals";

export async function loadManuals(): Promise<Manual[]> {
  try { return JSON.parse((await getSetting(KEY)) ?? "[]"); } catch { return []; }
}
export const saveManuals = (list: Manual[]) => setSetting(KEY, JSON.stringify(list));
