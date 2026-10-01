import "server-only";
import { getSetting } from "./store";

export type FloorPlan = { file: string; label: string };
export const FLOOR_PLANS_KEY = "floor_plans";

export async function loadFloorPlans(): Promise<FloorPlan[]> {
  try { return JSON.parse((await getSetting(FLOOR_PLANS_KEY)) ?? "[]"); } catch { return []; }
}
