// Builds a clean 3D model of each room from lib/room-plans.json (measured from the Polycam scan):
// walls extruded outward from the inside face (so inside dimensions are exact), windows and doors cut out at
// their measured sill and head heights, units as blocks, dimension lines along every wall.
// Run with: npm run models        Output: public/models/room-<id>.glb
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { Document, NodeIO } from "@gltf-transform/core";

const plans = JSON.parse(readFileSync(new URL("../lib/room-plans.json", import.meta.url), "utf8"));
const T = 0.12;        // wall thickness, extruded outward
const DIM_OFF = 0.32;  // dimension lines sit this far outside the wall
const DIM_W = 0.02;

const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => mul(a, 1 / Math.hypot(...a));

const newMesh = (kind) => ({ kind, pos: [], nrm: [], col: [], idx: [] });

// Baked shading, so the model has depth even under flat viewer lighting: faces are lit from above-left,
// and walls fade darker toward the floor (a cheap stand-in for ambient occlusion).
const LIGHT = unit([-0.35, 0.85, 0.4]);
let CEILING = 2.4;
function shade(kind, n, y) {
  if (kind === "dims") return [1, 1, 1, 1];
  const s = (0.5 + 0.5 * Math.max(0, dot(n, LIGHT))) / (0.5 + 0.5 * LIGHT[1]);
  let k = s;
  if (Math.abs(n[1]) < 0.5) k *= 0.72 + 0.28 * Math.min(1, Math.max(0, y / CEILING));
  if (kind === "units" && n[1] > 0.9) k *= 1.12;
  return [k, k, k, 1];
}
function quad(m, p, n) {
  // p = four corners; wound so the face points along n
  const w = cross(sub(p[1], p[0]), sub(p[2], p[0]));
  const q = dot(w, n) < 0 ? [p[0], p[3], p[2], p[1]] : p;
  const base = m.pos.length / 3;
  for (const v of q) { m.pos.push(...v); m.nrm.push(...n); m.col.push(...shade(m.kind, n, v[1])); }
  m.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
/** Box with one corner at o and edge vectors u, v, w. */
function box(m, o, u, v, w) {
  const c = (a, b, d) => add(add(add(o, mul(u, a)), mul(v, b)), mul(w, d));
  const f = (n, ...k) => quad(m, k.map((t) => c(...t)), unit(n));
  f(mul(u, -1), [0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]);
  f(u, [1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]);
  f(mul(v, -1), [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]);
  f(v, [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]);
  f(mul(w, -1), [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
  f(w, [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]);
}
/** A thin bar between two 3D points. */
function bar(m, p0, p1, t = DIM_W) {
  const u = sub(p1, p0); const hint = Math.abs(unit(u)[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const v = mul(unit(cross(u, hint)), t), w = mul(unit(cross(u, v)), t);
  box(m, sub(sub(p0, mul(v, 0.5)), mul(w, 0.5)), u, v, w);
}
/** Ear-clipping triangulation of a simple polygon of [x, z] points. */
function triangulate(pts) {
  const n = pts.length; const idx = [...Array(n).keys()];
  let area = 0; for (let i = 0; i < n; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % n]; area += x1 * z2 - x2 * z1; }
  if (area < 0) idx.reverse();
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inTri = (p, a, b, c) => cr(a, b, p) >= 0 && cr(b, c, p) >= 0 && cr(c, a, p) >= 0;
  const out = []; let guard = 0;
  while (idx.length > 3 && guard++ < 1000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if (cr(pts[a], pts[b], pts[c]) <= 1e-9) continue;
      if (idx.some((k) => k !== a && k !== b && k !== c && inTri(pts[k], pts[a], pts[b], pts[c]))) continue;
      out.push([a, b, c]); idx.splice(i, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}
const pointInPoly = (p, P) => {
  let inside = false;
  for (let k = 0, j = P.length - 1; k < P.length; j = k++) {
    const [xi, yi] = P[k], [xj, yj] = P[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

function buildRoom(plan) {
  const walls = newMesh("walls"), floor = newMesh("floor"), units = newMesh("units"), dims = newMesh("dims");
  const P = plan.points, n = P.length, C = plan.ceiling;
  CEILING = C;
  let S = 0; for (let i = 0; i < n; i++) S += P[i][0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * P[i][1];
  const orient = Math.sign(S);
  const dir = P.map((a, i) => { const b = P[(i + 1) % n]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
  const normal = dir.map((d, i) => {
    const a = P[i], b = P[(i + 1) % n], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const nn = [d[1], -d[0]];
    return pointInPoly([mid[0] + nn[0] * 0.05, mid[1] + nn[1] * 0.05], P) ? [-nn[0], -nn[1]] : nn;
  });
  // a corner is convex (seen from inside) when the polygon turns the same way as it is wound; those need the wall extended to close the outside corner
  const convex = P.map((_, i) => { const d0 = dir[i], d1 = dir[(i + 1) % n]; return (d0[0] * d1[1] - d0[1] * d1[0]) * orient > 0; });

  for (let i = 0; i < n; i++) {
    const a = P[i], d = dir[i], nm = normal[i], L = plan.edges[i].length;
    const end = L + (convex[i] ? T : 0);
    const seg = (s0, s1, y0, y1) => {
      if (s1 - s0 < 1e-3 || y1 - y0 < 1e-3) return;
      box(walls, [a[0] + d[0] * s0, y0, a[1] + d[1] * s0], [d[0] * (s1 - s0), 0, d[1] * (s1 - s0)], [nm[0] * T, 0, nm[1] * T], [0, y1 - y0, 0]);
    };
    let cur = 0;
    for (const o of [...plan.edges[i].openings].sort((p, q) => p.from - q.from)) {
      seg(cur, o.from, 0, C);
      const sill = o.kind === "window" ? o.sill ?? 0.9 : 0;
      const head = o.head ?? Math.max(sill + 0.8, C - 0.35); // head not captured by the scan: leave a lintel
      seg(o.from, o.to, 0, sill);
      seg(o.from, o.to, head, C);
      cur = o.to;
    }
    seg(cur, end, 0, C);

    // dimension line along the top, outside the wall, with end ticks reaching back to the wall
    const y = C + 0.02, off = T + DIM_OFF;
    const p0 = [a[0] + nm[0] * off, y, a[1] + nm[1] * off];
    const p1 = [p0[0] + d[0] * L, y, p0[2] + d[1] * L];
    bar(dims, p0, p1);
    for (const p of [p0, p1]) bar(dims, [p[0] - nm[0] * (DIM_OFF - 0.04), y, p[2] - nm[1] * (DIM_OFF - 0.04)], [p[0] + nm[0] * 0.06, y, p[2] + nm[1] * 0.06]);
  }

  // floor
  const tri = triangulate(P);
  const base = floor.pos.length / 3;
  for (const [x, z] of P) { floor.pos.push(x, 0, z); floor.nrm.push(0, 1, 0); floor.col.push(...shade("floor", [0, 1, 0], 0)); }
  for (const t of tri) {
    const [a, b, c] = t.map((k) => P[k]);
    const up = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); // sign in (x,z); y-up normal is -this for a right-handed (x,z) → flip to face +y
    floor.idx.push(base + t[0], ...(up > 0 ? [base + t[2], base + t[1]] : [base + t[1], base + t[2]]));
  }

  // units (counters, built-ins) as blocks
  for (const o of plan.obstacles) box(units, [o.x, 0, o.y], [o.w, 0, 0], [0, 0, o.h], [0, o.height, 0]);

  // ceiling-height dimension: a vertical bar outside the corner nearest the default camera (max x, max z)
  const mx = Math.max(...P.map((p) => p[0])), mz = Math.max(...P.map((p) => p[1]));
  const vx = mx + T + DIM_OFF, vz = mz + T + DIM_OFF;
  bar(dims, [vx, 0, vz], [vx, C, vz]);
  for (const y of [0, C]) bar(dims, [vx - 0.1, y, vz], [vx + 0.1, y, vz]);
  return { walls, floor, units, dims };
}

const io = new NodeIO();
mkdirSync(new URL("../public/models/", import.meta.url), { recursive: true });
for (const [id, plan] of Object.entries(plans)) {
  const doc = new Document(); const buf = doc.createBuffer(); const scene = doc.createScene(id);
  // Each level gets its own colours so you can tell at a glance which floor a room is on: warm sand downstairs, cool lavender upstairs.
  const LEVEL = plan.level === 0
    ? { walls: [0.92, 0.84, 0.7, 1], floor: [0.7, 0.55, 0.38, 1] }
    : { walls: [0.82, 0.8, 0.95, 1], floor: [0.58, 0.55, 0.8, 1] };
  const mats = {
    walls: doc.createMaterial("walls").setBaseColorFactor(LEVEL.walls).setRoughnessFactor(0.95).setMetallicFactor(0).setDoubleSided(true),
    floor: doc.createMaterial("floor").setBaseColorFactor(LEVEL.floor).setRoughnessFactor(0.9).setMetallicFactor(0).setDoubleSided(true),
    units: doc.createMaterial("units").setBaseColorFactor([0.66, 0.46, 0.3, 1]).setRoughnessFactor(0.9).setMetallicFactor(0),
    dims: doc.createMaterial("dimensions").setBaseColorFactor([0.71, 0.35, 0.18, 1]).setRoughnessFactor(0.6).setMetallicFactor(0),
  };
  const built = buildRoom(plan);
  const mesh = doc.createMesh(id);
  for (const key of ["walls", "floor", "units", "dims"]) {
    const m = built[key]; if (!m.idx.length) continue;
    const prim = doc.createPrimitive().setMaterial(mats[key])
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(m.pos)).setBuffer(buf))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(m.nrm)).setBuffer(buf))
      .setAttribute("COLOR_0", doc.createAccessor().setType("VEC4").setArray(new Float32Array(m.col)).setBuffer(buf))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(m.idx)).setBuffer(buf));
    mesh.addPrimitive(prim);
  }
  scene.addChild(doc.createNode(id).setMesh(mesh));
  const out = new URL(`../public/models/room-${id}.glb`, import.meta.url);
  await io.write(out.pathname, doc);
  console.log(id, "tris", built.walls.idx.length / 3 + built.floor.idx.length / 3 + built.units.idx.length / 3 + built.dims.idx.length / 3);
}
