/**
 * Annotated plans for each room: wall-to-wall outline, every wall length, doors and windows with their sill and
 * head heights, and fixed units. Measured from the Polycam scan: outlines come from cross-sections of the scan at
 * chest height and 35 cm, each wall snapped to the scan surface (about 2 cm). Door and window positions are read
 * from Polycam's floor plan, and their heights from slices every 10 cm up the wall (about 10 cm).
 * Everything is in metres. Points are relative to the top-left corner of the room's bounding box, y down.
 */
export type PlanOpening = { kind: "door" | "window"; label: string; from: number; to: number; width: number; sill: number | null; head: number | null };
export type PlanEdge = { length: number; openings: PlanOpening[] };
export type PlanObstacle = { label: string; x: number; y: number; w: number; h: number; height: number };
export type RoomPlan = {
  title: string; level: 0 | 1; levelName: string;
  ceiling: number; area: number; width: number; depth: number;
  points: [number, number][]; edges: PlanEdge[]; obstacles: PlanObstacle[]; notes: string[];
};

import data from "./room-plans.json";

/** Source of truth is room-plans.json; `npm run models` turns it into the 3D models in public/models. */
export const ROOM_PLANS = data as unknown as Record<string, RoomPlan>;
