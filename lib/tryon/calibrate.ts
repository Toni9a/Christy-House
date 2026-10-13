import "server-only";
import sharp from "sharp";
import type { RoomPlan } from "@/lib/room-plans";
import { fitCamera, type Camera, type Correspondence, type Vec3 } from "./camera";
import { askJson } from "./gemini";

/**
 * Calibrating a room photo: Gemini points at the room's numbered corners (and the edges of doors and windows) in the
 * photo, using a labelled plan to tell them apart, and a camera is fitted to those points by least squares. The
 * result is checked: if the fitted camera cannot put the corners back within about 1.5% of the photo width, the
 * photo is rejected rather than used with a wrong scale.
 */
type Landmark = { name: string; desc: string } & ({ world: Vec3; line?: never } | { line: [Vec3, Vec3]; world?: never });

function landmarks(plan: RoomPlan): Landmark[] {
  const n = plan.points.length, L: Landmark[] = [];
  const letter = (i: number) => String.fromCharCode(65 + i);
  plan.points.forEach(([x, y], i) => {
    const between = `between wall ${letter((i + n - 1) % n)} and wall ${letter(i)}`;
    L.push({ name: `${i + 1}F`, world: [x, y, 0], desc: `corner ${i + 1} (${between}) where it meets the floor` });
    L.push({ name: `${i + 1}C`, world: [x, y, plan.ceiling], desc: `corner ${i + 1} (${between}) where it meets the ceiling` });
  });
  plan.edges.forEach((_, i) => {
    const [ax, ay] = plan.points[i], [bx, by] = plan.points[(i + 1) % n];
    L.push({ name: `${letter(i)}-floor`, line: [[ax, ay, 0], [bx, by, 0]], desc: `wall ${letter(i)}: points along the line where it meets the floor (skirting line)` });
    L.push({ name: `${letter(i)}-ceiling`, line: [[ax, ay, plan.ceiling], [bx, by, plan.ceiling]], desc: `wall ${letter(i)}: points along the line where it meets the ceiling` });
  });
  plan.edges.forEach((e, i) => {
    const [ax, ay] = plan.points[i], [bx, by] = plan.points[(i + 1) % n], len = Math.hypot(bx - ax, by - ay);
    const at = (d: number): [number, number] => [ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len];
    e.openings.forEach((o, j) => {
      const lo = o.kind === "door" ? 0 : o.sill, hi = o.head;
      const ends: [string, number][] = [[`end nearer corner ${i + 1}`, o.from], [`end nearer corner ${((i + 1) % n) + 1}`, o.to]];
      for (const [side, d] of ends) {
        const [x, y] = at(d), tag = `${letter(i)}${j + 1}${d === o.from ? "a" : "b"}`;
        if (lo != null) L.push({ name: `${tag}-low`, world: [x, y, lo], desc: `${o.label.toLowerCase()} on wall ${letter(i)}, ${side}: the ${o.kind === "door" ? "bottom of the frame at the floor" : "bottom corner of the opening at the sill"}` });
        if (hi != null) L.push({ name: `${tag}-high`, world: [x, y, hi], desc: `${o.label.toLowerCase()} on wall ${letter(i)}, ${side}: the top corner of the opening` });
      }
    });
  });
  return L;
}

/** A top-down plan with numbered corners, lettered walls and doors/windows, for Gemini to read. */
async function planImage(plan: RoomPlan) {
  const S = 140, pad = 70, W = Math.round(plan.width * S + pad * 2), H = Math.round(plan.depth * S + pad * 2);
  const P = ([x, y]: number[]) => [pad + x * S, pad + y * S];
  const n = plan.points.length;
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#fff"/>`;
  svg += `<polygon points="${plan.points.map((p) => P(p).join(",")).join(" ")}" fill="#f1ede4" stroke="#222" stroke-width="5"/>`;
  plan.edges.forEach((e, i) => {
    const a = plan.points[i], b = plan.points[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const at = (d: number) => P([a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len]);
    for (const o of e.openings) {
      const [p, q] = [at(o.from), at(o.to)];
      svg += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${o.kind === "door" ? "#c2410c" : "#0284c7"}" stroke-width="12"/>`;
      svg += `<text x="${(p[0] + q[0]) / 2}" y="${(p[1] + q[1]) / 2 - 12}" font-size="20" font-family="sans-serif" text-anchor="middle" fill="${o.kind === "door" ? "#c2410c" : "#0284c7"}">${o.label}</text>`;
    }
    const [mx, my] = at(len / 2), nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
    svg += `<text x="${mx - nx * 26}" y="${my - ny * 26 + 8}" font-size="22" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="#666">${String.fromCharCode(65 + i)}</text>`;
  });
  plan.points.forEach((p, i) => {
    const [x, y] = P(p);
    svg += `<circle cx="${x}" cy="${y}" r="17" fill="#e11d48"/><text x="${x}" y="${y + 8}" font-size="22" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="#fff">${i + 1}</text>`;
  });
  return sharp(Buffer.from(svg + "</svg>")).png().toBuffer();
}

export type Calibration = { cam: Camera; rmsPct: number; used: number; dropped: string[] };

export async function calibratePhoto(photo: Buffer, plan: RoomPlan): Promise<Calibration> {
  const img = sharp(photo).rotate();
  const { width: W, height: H } = await img.metadata().then(async (m) => {
    const o = (m.orientation ?? 1) >= 5; return { width: o ? m.height! : m.width!, height: o ? m.width! : m.height! };
  });
  const L = landmarks(plan);
  const prompt = `Image 1 is a top-down floor plan of a room (${plan.title}, ceiling ${plan.ceiling} m). Corners are red numbered dots, walls are grey letters, windows are blue and doors are orange. Image 2 is a photo taken inside that room.

Work out where the photo was taken from and which walls it shows (use the windows, doors and the room's shape). Then find these points in the photo. Only give points you can actually see: skip any that are hidden, out of frame or that you are unsure of. Be precise: the exact pixel where the edges meet.

${L.map((l) => `- ${l.name}: ${l.desc}`).join("\n")}

For the wall lines ("-floor" / "-ceiling"), give 3 to 5 points spread along the visible part of the line, each as its own entry with the same name. Skip lines hidden behind furniture or curtains.

Return JSON: {"view": "one sentence: where the camera is and what it faces", "points": [{"name": "...", "point": [y, x]}]} with y and x normalised to 0-1000.`;
  // Three independent reads, pooled: a corner one read mislabels gets outvoted by the other two in the fit.
  const images = [await planImage(plan), await img.jpeg().toBuffer()];
  const answers = await Promise.all([0, 1, 2].map(() => askJson<{ view?: string; points?: { name: string; point: [number, number] }[] }>(prompt, images).catch(() => ({ points: [] }))));
  const ans = { points: answers.flatMap((a) => a.points ?? []) };
  const byName = new Map(L.map((l) => [l.name, l]));
  const pairs: Correspondence[] = (ans.points ?? []).flatMap((p, k) => {
    const l = byName.get(p.name);
    if (!l || !Array.isArray(p.point)) return [];
    const px: [number, number] = [(p.point[1] / 1000) * W, (p.point[0] / 1000) * H];
    return [l.world ? { name: p.name, world: l.world, px } : { name: `${p.name}#${k}`, line: l.line!, px }];
  });
  const corners = pairs.filter((p) => p.world).length;
  if (corners < 6 || pairs.length < 20) throw new Error(`Could not find enough of the room's corners in this photo. Take one from a corner of the room that shows at least two walls, the floor and the ceiling.`);
  const xs = plan.points.map((p) => p[0]), ys = plan.points.map((p) => p[1]);
  const fit = fitCamera(pairs, W, H, { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
  return { cam: fit.cam, rmsPct: fit.rmsPct, used: pairs.length - fit.dropped.length, dropped: fit.dropped };
}
