import type { Camera } from "./camera";
import type { Placement, Shape } from "./massing";

/** A room photo the camera has been fitted to, so furniture can be drawn into it at real size. */
export type TryView = { id: string; roomId: string; file: string; cam: Camera; rmsPct: number; addedBy: string | null; addedAt: string };

/** What we know about the piece of furniture, read from its photo and confirmed or corrected by a person. */
export type ItemSpec = {
  category: string;
  widthCm: number; depthCm: number; heightCm: number;
  dimsSource: "printed" | "estimated" | "typed";
  shape: Shape;
  photoShape?: Shape;       // which way round it is in the photo (corner/chaise on the left or right), as read
  seatDepthCm?: number; returnWidthCm?: number;
  seatsBack?: number;       // seat cushions along the main run (corner seat included)
  seatsReturn?: number;     // seat cushions on the corner/chaise part, not counting the corner
  layout: string;           // e.g. "3 seats along the back, chaise on the left"
  identity: string[];       // checkable visual facts that make it this product
  leaveOut: string;         // separate pieces / people / props in the photo that are not part of it
  mechanisms: string;       // things to show closed (sofa bed, recliner)
  notes: string;            // how the size was worked out
};

export type RenderChecks = { widthErrPct: number | null; heightErrPct: number | null; fitPct: number; roomShift: number };
export type TryRender = {
  id: string; viewId: string; roomId: string; itemFile: string; title: string;
  spec: ItemSpec; placement: Placement;
  result: string; plate: string; guide: string;
  checks: RenderChecks; addedBy: string | null; addedAt: string;
};
