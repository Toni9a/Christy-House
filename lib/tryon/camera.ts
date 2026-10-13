/**
 * A pinhole camera fitted to a room photo, so a measured plan can be drawn into the photo exactly.
 * World coordinates are the room plan's: x and y in metres on the floor (as in room-plans.json, y down the plan),
 * z up from the floor. Image coordinates are pixels of the original photo. Runs in the browser and on the server.
 */
export type Vec3 = [number, number, number];
export type Camera = { focal: number; rot: [number, number, number]; pos: Vec3; cx: number; cy: number; W: number; H: number };

function axes([yaw, pitch, roll]: [number, number, number]) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const f: Vec3 = [-sy * cp, -cy * cp, sp]; // yaw 0 looks along -y (towards the top of the plan)
  const r: Vec3 = [cy, -sy, 0];
  const u: Vec3 = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  return { f, r: r.map((v, i) => v * cr + u[i] * sr) as Vec3, u: u.map((v, i) => v * cr - r[i] * sr) as Vec3 };
}

/** Pixel position of a world point, and its depth in front of the camera (negative = behind). */
export function project(cam: Camera, p: Vec3): [number, number, number] {
  const { f, r, u } = axes(cam.rot);
  const d = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  const x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2];
  const y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
  return [cam.cx + (cam.focal * x) / z, cam.cy - (cam.focal * y) / z, z];
}

/** Same camera, seen through a crop of the photo scaled to `scale` (used to draw guides at another resolution). */
export const cropCamera = (cam: Camera, left: number, top: number, scale: number, W: number, H: number): Camera =>
  ({ ...cam, cx: (cam.cx - left) * scale, cy: (cam.cy - top) * scale, focal: cam.focal * scale, W, H });

function nelderMead(fn: (x: number[]) => number, x0: number[], steps: number[], iters = 3000) {
  const n = x0.length;
  let s = [x0, ...x0.map((_, i) => x0.map((v, j) => (j === i ? v + steps[i] : v)))].map((x) => ({ x, v: fn(x) }));
  for (let k = 0; k < iters; k++) {
    s.sort((a, b) => a.v - b.v);
    const c = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += s[i].x[j] / n;
    const w = s[n], at = (t: number) => c.map((v, j) => v + t * (w.x[j] - v));
    const xr = at(-1), vr = fn(xr);
    if (vr < s[0].v) { const xe = at(-2), ve = fn(xe); s[n] = ve < vr ? { x: xe, v: ve } : { x: xr, v: vr }; }
    else if (vr < s[n - 1].v) s[n] = { x: xr, v: vr };
    else {
      const xc = at(0.5), vc = fn(xc);
      if (vc < w.v) s[n] = { x: xc, v: vc };
      else s = s.map((p, i) => { if (!i) return p; const x = p.x.map((v, j) => s[0].x[j] + 0.5 * (v - s[0].x[j])); return { x, v: fn(x) }; });
    }
  }
  s.sort((a, b) => a.v - b.v);
  return s[0];
}

/** A photo pixel tied to a known plan point, or to somewhere on a known straight edge (e.g. a wall's skirting line). */
export type Correspondence = { name: string; px: [number, number] } & ({ world: Vec3; line?: never } | { line: [Vec3, Vec3]; world?: never });

/** Pixel error of one correspondence under a camera (distance to the point, or to the edge's image line). */
function residual(cam: Camera, q: Correspondence): number {
  if (q.world) { const [u, v, z] = project(cam, q.world); return z <= 0.1 ? Infinity : Math.hypot(u - q.px[0], v - q.px[1]); }
  let [a, b] = q.line!;
  // keep both ends in front of the camera
  const za = project(cam, a)[2], zb = project(cam, b)[2];
  if (za <= 0.1 && zb <= 0.1) return Infinity;
  const lerp = (p: Vec3, r: Vec3, t: number): Vec3 => [p[0] + (r[0] - p[0]) * t, p[1] + (r[1] - p[1]) * t, p[2] + (r[2] - p[2]) * t];
  if (za <= 0.1) a = lerp(b, a, (zb - 0.2) / (zb - za)); else if (zb <= 0.1) b = lerp(a, b, (za - 0.2) / (za - zb));
  const [x1, y1] = project(cam, a), [x2, y2] = project(cam, b), len = Math.hypot(x2 - x1, y2 - y1);
  return len < 1 ? Infinity : Math.abs((x2 - x1) * (y1 - q.px[1]) - (x1 - q.px[0]) * (y2 - y1)) / len;
}

/**
 * Fits yaw/pitch/roll, position and focal length (principal point at the centre, square pixels) to plan↔photo pairs.
 * One flat wall can't tell zooming in from walking closer, so the focal length is tried at the few lenses phones
 * have (0.5×, 1×, 2×, 3×, 5×, as 35 mm equivalents) and also left free; a free focal has to fit clearly better to win.
 * Each fit starts from a spread of positions and directions inside `area`, then the worst outliers are dropped.
 */
const PHONE_LENSES_MM = [13, 24, 26, 28, 48, 52, 77, 120];

export function fitCamera(pairs: Correspondence[], W: number, H: number, area: { x0: number; y0: number; x1: number; y1: number }, slack = 0.7) {
  const long = Math.max(W, H);
  const unpack = (p: number[], focal: number | null): Camera => ({ focal: (focal ?? p[0]) * W, rot: [p[1], p[2], p[3]], pos: [p[4], p[5], p[6]], cx: W / 2, cy: H / 2, W, H });
  const costFor = (ps: Correspondence[], focal: number | null) => (p: number[]) => {
    if ((focal == null && (p[0] < 0.3 || p[0] > 3)) || Math.abs(p[2]) > 0.9 || Math.abs(p[3]) > 0.5 || p[6] < 0.3 || p[6] > 2.6) return 1e12;
    // the photographer stands in the room (or its doorway)
    if (p[4] < area.x0 - slack || p[4] > area.x1 + slack || p[5] < area.y0 - slack || p[5] > area.y1 + slack) return 1e12;
    const cam = unpack(p, focal);
    let e = 0;
    for (const q of ps) { const r = residual(cam, q); if (!isFinite(r)) return 1e12; e += q.world ? 2 * r * r : r * r; } // points pin 2 axes, lines 1
    return e;
  };
  const report = (ps: Correspondence[], x: number[], focal: number | null) => {
    const cam = unpack(x, focal);
    const errors = ps.map((q) => ({ name: q.name, err: residual(cam, q) }));
    return { x, cam, rms: Math.sqrt(errors.reduce((s, e) => s + e.err ** 2, 0) / ps.length), errors };
  };
  const polish = (cost: (p: number[]) => number, x: number[]) => {
    let r = { x, v: cost(x) };
    for (let k = 0; k < 4; k++) {
      const next = nelderMead(cost, r.x, k % 2 ? [0.01, 0.01, 0.01, 0.005, 0.05, 0.05, 0.03] : [0.05, 0.05, 0.05, 0.02, 0.2, 0.2, 0.1], 1500);
      const done = next.v > r.v * 0.999;
      if (next.v < r.v) r = next;
      if (done && k > 0) break;
    }
    return r.x;
  };
  const solve = (ps: Correspondence[], focal: number | null) => {
    // find the right basin on the corner points only (cheap), then polish on everything
    const corners = ps.filter((q) => q.world);
    const coarse = costFor(corners.length >= 5 ? corners : ps, focal);
    let best: { x: number[]; v: number } | null = null;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 8; k++) {
      const x0 = [focal ?? 0.8, (k * Math.PI) / 4, -0.1, 0, area.x0 + ((i + 0.5) / 2) * (area.x1 - area.x0), area.y0 + ((j + 0.5) / 2) * (area.y1 - area.y0), 1.5];
      const r = nelderMead(coarse, x0, [focal == null ? 0.2 : 0, 0.3, 0.1, 0.05, 0.5, 0.5, 0.3], 300);
      if (!best || r.v < best.v) best = r;
    }
    return report(ps, polish(costFor(ps, focal), best!.x), focal);
  };
  const run = (focal: number | null) => {
    let used = pairs, fit = solve(used, focal), dropped: string[] = [];
    for (let k = 0; k < Math.min(4, Math.floor(pairs.length / 5)) && used.length > 6; k++) {
      const worst = fit.errors.reduce((a, b) => (b.err > a.err ? b : a));
      if (worst.err < W * 0.015) break;
      dropped = [...dropped, worst.name];
      used = used.filter((q) => q.name !== worst.name);
      fit = report(used, polish(costFor(used, focal), fit.x), focal);
    }
    return { ...fit, dropped };
  };
  const free = run(null);
  let best = { ...free, rms: free.rms * 1.15 }; // a free focal must beat a real lens by 15%
  for (const mm of PHONE_LENSES_MM) {
    const f = ((long * mm) / 36) / W;
    if (Math.abs(Math.log(f / (free.cam.focal / W))) > 0.6) continue; // nowhere near: skip
    const r = run(f);
    if (r.rms < best.rms) best = r;
  }
  const { x: _x, ...out } = best;
  return { ...out, rms: best === free ? free.rms : best.rms, rmsPct: ((best === free ? free.rms : best.rms) / W) * 100 };
}
