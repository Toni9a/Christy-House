/**
 * A rough block model of a piece of furniture (back, seat, arms, corner return) at its real size, placed on the plan.
 * Drawn from the photo's camera it shows exactly how much room the item takes, and it is the pose guide Gemini
 * draws the real product into. Runs in the browser and on the server.
 */
import { project, type Camera, type Vec3 } from "./camera";

export type Shape = "straight" | "corner-left" | "corner-right" | "chaise-left" | "chaise-right" | "box";
export type ItemSize = { kind: string; width: number; depth: number; height: number; shape: Shape; seatDepth?: number; returnWidth?: number; seats?: number; seatsReturn?: number };
/** Where the item stands: (x, y) is its back-left corner on the plan, as you face it; rot turns it clockwise in degrees. */
export type Placement = { x: number; y: number; rot: number };

const isSeat = (kind: string) => /sofa|couch|settee|armchair|chair/i.test(kind);

/** Boxes in the item's own frame: x left→right as you face it, y back (0) → front, z up. Metres. */
function localBoxes(s: ItemSize): [number, number, number, number, number, number][] {
  const { width: W, depth: D, height: H } = s;
  if (s.shape === "box" || !isSeat(s.kind)) return [[0, 0, 0, W, D, H]];
  const L = s.shape !== "straight";
  // listings often give cushion sizes, not section sizes: keep the sections to what sofas actually are
  const clamp = (v: number | undefined, lo: number, hi: number, d: number) => Math.max(lo, Math.min(hi, v ?? d));
  const sd = L ? Math.min(clamp(s.seatDepth, 0.75, 1.1, 0.9), D) : D;
  const rw = Math.min(clamp(s.returnWidth, 0.7, 1.1, 0.9), W / 2);
  const back = Math.min(0.22, sd * 0.25), seatH = H * 0.52, armW = Math.min(0.2, W * 0.08), armH = H * 0.72;
  const out: [number, number, number, number, number, number][] = [[0, 0, 0, W, back, H]];
  // seat cushions along the main run, with small gaps, so the guide shows how many there are
  const cushions = (x0: number, x1: number, y0: number, y1: number, n: number, alongY = false) => {
    const gap = 0.015, k = Math.max(1, n);
    for (let i = 0; i < k; i++) {
      const a = (alongY ? y0 : x0) + (i * ((alongY ? y1 - y0 : x1 - x0))) / k + (i ? gap / 2 : 0);
      const b = (alongY ? y0 : x0) + ((i + 1) * ((alongY ? y1 - y0 : x1 - x0))) / k - (i < k - 1 ? gap / 2 : 0);
      out.push(alongY ? [x0, a, 0, x1, b, seatH] : [a, y0, 0, b, y1, seatH]);
    }
  };
  if (!L) { cushions(armW, W - armW, back, sd, s.seats ?? 1); return [...out, [0, back, 0, armW, D, armH], [W - armW, back, 0, W, D, armH]]; }
  const left = s.shape.endsWith("left"), corner = s.shape.startsWith("corner");
  const rx = left ? 0 : W - rw;
  const corner0 = s.shape.startsWith("corner");
  cushions(left && !corner0 ? 0 : left ? back : armW, left ? W - armW : corner0 ? W - back : W, back, sd, s.seats ?? 1);
  cushions(left ? (corner0 ? back : armW) : rx, left ? rx + rw : W - (corner0 ? back : armW), sd, D, s.seatsReturn ?? 1, true);
  // along the return: a full-height back for a corner sofa, an arm for a chaise
  const sideW = corner ? back : armW, sideH = corner ? H : armH;
  out.push(left ? [0, back, 0, sideW, D, sideH] : [W - sideW, back, 0, W, D, sideH]);
  out.push(left ? [W - armW, back, 0, W, sd, armH] : [0, back, 0, armW, sd, armH]);
  return out;
}

export type Block = Vec3[]; // 8 corners: floor 0-3, top 4-7

export function toWorld(p: Placement) {
  const r = (p.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return ([x, y, z]: Vec3): Vec3 => [p.x + x * c - y * s, p.y + x * s + y * c, z];
}

export function massing(size: ItemSize, place: Placement): Block[] {
  const w = toWorld(place);
  return localBoxes(size).map(([x0, y0, z0, x1, y1, z1]) =>
    ([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] as Vec3[]).map(w));
}

/** The item's outer footprint on the plan (4 corners), for the plan view and the clash checks. */
export function footprint(size: ItemSize, place: Placement): [number, number][] {
  const w = toWorld(place);
  return ([[0, 0, 0], [size.width, 0, 0], [size.width, size.depth, 0], [0, size.depth, 0]] as Vec3[]).map((p) => w(p).slice(0, 2) as [number, number]);
}

const FACES = [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
const SHADE = [228, 168, 142, 196, 122]; // top, back, right, front, left

/** Visible faces of the blocks, far to near, as pixel polygons. */
export function facePolygons(cam: Camera, blocks: Block[]) {
  const polys: { depth: number; pts: [number, number][]; shade: number }[] = [];
  for (const v of blocks) {
    const c = v.reduce<number[]>((a, p) => a.map((s, i) => s + p[i] / 8), [0, 0, 0]);
    FACES.forEach((f, fi) => {
      const fc = f.reduce<number[]>((a, i) => a.map((s, k) => s + v[i][k] / 4), [0, 0, 0]);
      const toCam = cam.pos.map((p, k) => p - fc[k]);
      if ((fc[0] - c[0]) * toCam[0] + (fc[1] - c[1]) * toCam[1] + (fc[2] - c[2]) * toCam[2] <= 0) return;
      polys.push({ depth: Math.hypot(...toCam), pts: f.map((i) => project(cam, v[i]).slice(0, 2) as [number, number]), shade: SHADE[fi] });
    });
  }
  return polys.sort((a, b) => b.depth - a.depth);
}

/** SVG of the shaded blocks. `mask` draws them solid white (for fit checks); `bg` fills the background. */
export function blocksSvg(cam: Camera, blocks: Block[], opts: { bg?: string; mask?: boolean; stroke?: string } = {}) {
  const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  return `<svg width="${cam.W}" height="${cam.H}" viewBox="0 0 ${cam.W} ${cam.H}" xmlns="http://www.w3.org/2000/svg">` +
    (opts.bg ? `<rect width="${cam.W}" height="${cam.H}" fill="${opts.bg}"/>` : "") +
    facePolygons(cam, blocks).map((p) =>
      `<polygon points="${p.pts.map(pt).join(" ")}" fill="${opts.mask ? "#fff" : `rgb(${p.shade},${p.shade},${p.shade})`}" stroke="${opts.mask ? "#fff" : opts.stroke ?? "rgba(0,0,0,.25)"}" stroke-width="${Math.max(1, cam.W / 600).toFixed(1)}" stroke-linejoin="round"/>`).join("") +
    `</svg>`;
}

/** Pixel bounds of the blocks in the photo. */
export function bounds(cam: Camera, blocks: Block[]) {
  const pts = blocks.flat().map((p) => project(cam, p));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
