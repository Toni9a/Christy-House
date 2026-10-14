"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RoomPlan } from "@/lib/room-plans";
import { project, type Vec3 } from "@/lib/tryon/camera";
import { facePolygons, footprint, massing, type Placement, type Shape } from "@/lib/tryon/massing";
import type { ItemSpec, TryRender, TryView } from "@/lib/tryon/types";
import type { RoomPhoto } from "@/lib/types";
import { fileUrl, uploadFile } from "@/lib/upload";
import { Dropzone } from "./Dropzone";
import { Button, inputCls } from "./ui";

type Room = { id: string; name: string };
type Pos = { cx: number; cy: number; rot: number }; // centre of the footprint on the plan, and turn in degrees

const SHAPES: { value: Shape; label: string }[] = [
  { value: "straight", label: "Straight" }, { value: "corner-left", label: "Corner, left" }, { value: "corner-right", label: "Corner, right" },
  { value: "chaise-left", label: "Chaise, left" }, { value: "chaise-right", label: "Chaise, right" }, { value: "box", label: "Box (not a seat)" },
];

const sizeOf = (s: ItemSpec) => ({ kind: s.category, width: s.widthCm / 100, depth: s.depthCm / 100, height: s.heightCm / 100, shape: s.shape,
  seatDepth: s.seatDepthCm ? s.seatDepthCm / 100 : undefined, returnWidth: s.returnWidthCm ? s.returnWidthCm / 100 : undefined, seats: s.seatsBack, seatsReturn: s.seatsReturn });

function toPlacement(p: Pos, s: ItemSpec): Placement {
  const r = (p.rot * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r), w = s.widthCm / 200, d = s.depthCm / 200;
  return { x: p.cx - (w * c - d * sn), y: p.cy - (w * sn + d * c), rot: p.rot };
}

/** Inward normals of the plan's walls (works whichever way round the outline is drawn). */
function walls(plan: RoomPlan) {
  const pts = plan.points, n = pts.length;
  const area = pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * p[1], 0);
  return pts.map((a, i) => {
    const b = pts[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], s = area > 0 ? 1 : -1;
    return { i, a, b, len, t, n: [-t[1] * s, t[0] * s] as [number, number] };
  });
}

function inside(plan: RoomPlan, [x, y]: [number, number]) {
  let c = false;
  const p = plan.points;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  return c;
}

/** Back of the item flush against a wall (3 cm gap), facing into the room, at `along` metres from the wall's start. */
function againstWall(plan: RoomPlan, wi: number, s: ItemSpec, along?: number): Pos {
  const w = walls(plan)[wi], d = s.depthCm / 100, at = along ?? w.len / 2;
  const rot = (Math.atan2(-w.n[0], w.n[1]) * 180) / Math.PI; // front (local +y) = inward normal
  return { cx: w.a[0] + w.t[0] * at + w.n[0] * (d / 2 + 0.03), cy: w.a[1] + w.t[1] * at + w.n[1] * (d / 2 + 0.03), rot: Math.round(rot) };
}

/** The wall this photo looks at most squarely (long enough to take the item), for the first placement. */
function facingWall(plan: RoomPlan, view: TryView, s: ItemSpec) {
  let best = 0, score = -Infinity;
  for (const w of walls(plan)) {
    if (w.len < s.widthCm / 100) continue;
    const mid: Vec3 = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2, 0.4];
    const [u, v, z] = project(view.cam, mid);
    if (z <= 0 || u < 0 || u > view.cam.W || v < 0 || v > view.cam.H) continue;
    const toCam = [view.cam.pos[0] - mid[0], view.cam.pos[1] - mid[1]], l = Math.hypot(toCam[0], toCam[1]);
    const sc = (w.n[0] * toCam[0] + w.n[1] * toCam[1]) / l + w.len * 0.05;
    if (sc > score) { score = sc; best = w.i; }
  }
  return best;
}

export function TryOn({ rooms, plans, photos, initialViews, initialRenders, ideas }: {
  rooms: Room[]; plans: Record<string, RoomPlan>; photos: RoomPhoto[]; initialViews: TryView[]; initialRenders: TryRender[];
  ideas: { file: string; title: string }[];
}) {
  const [itemFile, setItemFile] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [spec, setSpec] = useState<ItemSpec | null>(null);
  const [reading, setReading] = useState(false);
  const [roomId, setRoomId] = useState(rooms.find((r) => plans[r.id])?.id ?? "");
  const [views, setViews] = useState(initialViews);
  const [viewId, setViewId] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState<string | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<TryRender | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const [renders, setRenders] = useState(initialRenders);
  const [error, setError] = useState<string | null>(null);

  const plan = plans[roomId];
  const roomViews = views.filter((v) => v.roomId === roomId);
  const view = views.find((v) => v.id === viewId) ?? null;
  const roomPhotos = photos.filter((p) => p.roomId === roomId && !views.some((v) => v.file === p.file));

  // pick the best-measured view of the room, and put the item against the wall that photo faces
  useEffect(() => {
    if (!roomViews.some((v) => v.id === viewId)) setViewId([...roomViews].sort((a, b) => a.rmsPct - b.rmsPct)[0]?.id ?? null);
  }, [roomId, views]); // eslint-disable-line
  // measure the room's photos automatically, one at a time (each takes about 20s, once ever)
  const [failed, setFailed] = useState<string[]>([]);
  const queue = roomPhotos.filter((p) => !failed.includes(p.file));
  useEffect(() => {
    if (measuring || !queue.length) return;
    const file = queue[0].file;
    setMeasuring(file);
    fetch("/api/tryon/views", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId, file }) })
      .then(async (r) => { const data = await r.json(); if (r.ok) setViews((v) => [...v.filter((x) => x.file !== data.file), data]); else setFailed((f) => [...f, file]); })
      .catch(() => setFailed((f) => [...f, file]))
      .finally(() => setMeasuring(null));
  }, [roomId, queue.length, measuring]); // eslint-disable-line
  useEffect(() => { if (spec && plan && view) setPos(againstWall(plan, facingWall(plan, view, spec), spec)); }, [viewId, roomId, spec?.widthCm, spec?.depthCm]); // eslint-disable-line

  async function addItemPhoto(f: File | null) {
    setError(null); setSpec(null); setResult(null); setItemFile(null);
    if (!f) return;
    setReading(true);
    try {
      const name = await uploadFile(f);
      setItemFile(name);
      await readItem(name);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    setReading(false);
  }
  async function readItem(name: string, hint = title) {
    setReading(true); setError(null);
    try {
      const r = await fetch("/api/tryon/analyse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file: name, hint }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSpec(data);
      if (!title) setTitle(data.category[0].toUpperCase() + data.category.slice(1));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t read that photo"); }
    setReading(false);
  }

  async function measurePhoto(source: File | string) {
    setMeasuring(typeof source === "string" ? source : "upload"); setError(null);
    try {
      const file = typeof source === "string" ? source : await uploadFile(source);
      const r = await fetch("/api/tryon/views", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId, file }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setViews((v) => [...v.filter((x) => x.file !== data.file), data]);
      setViewId(data.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t measure that photo"); }
    setMeasuring(null);
  }
  async function forgetView(id: string) {
    await fetch(`/api/tryon/views?id=${id}`, { method: "DELETE" });
    setViews((v) => v.filter((x) => x.id !== id));
  }

  async function draw() {
    if (!spec || !view || !pos || !itemFile) return;
    setBusy(true); setError(null); setResult(null); setShowBefore(false);
    const steps = ["Drawing your exact piece at this angle…", "Cutting it out and placing it at its measured size…", "Matching the room’s light and shadows…", "Measuring the result…"];
    let k = 0; setStage(steps[0]);
    const timer = setInterval(() => { k = Math.min(k + 1, steps.length - 1); setStage(steps[k]); }, 14000);
    try {
      const r = await fetch("/api/tryon/render", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewId: view.id, itemFile, title, spec, placement: toPlacement(pos, spec) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResult(data); setRenders((x) => [data, ...x]);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t draw it"); }
    clearInterval(timer); setBusy(false);
  }

  const set = (patch: Partial<ItemSpec>) => setSpec((s) => (s ? { ...s, ...patch } : s));

  return (
    <div className="space-y-8">
      {/* 1 · the furniture */}
      <Step n={1} title="Your furniture" hint="A listing screenshot with the dimensions on it is best. Any photo works.">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="space-y-3">
            <Dropzone preview={itemFile ? fileUrl(itemFile) : null} onFile={addItemPhoto} />
            {!itemFile && ideas.length > 0 && (
              <div>
                <p className="mb-2 text-[13px] text-muted">…or one of your ideas</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {ideas.map((i) => (
                    <button key={i.file} onClick={() => { setItemFile(i.file); setTitle(i.title); readItem(i.file, i.title); }}
                      className="w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-sunken text-left hover:ring-2 hover:ring-accent">
                      <img src={fileUrl(i.file)} alt="" className="aspect-square w-full object-cover" />
                      <span className="block truncate px-1.5 py-1 text-[11px]">{i.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            {reading && <p className="text-sm text-muted">Reading the photo: what it is, its size and its details…</p>}
            {spec && !reading && (
              <div className="space-y-3">
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name, e.g. Grey sofa bed" />
                <div className="grid grid-cols-3 gap-2">
                  {(["widthCm", "depthCm", "heightCm"] as const).map((k) => (
                    <label key={k} className="text-[12px] text-muted">
                      {{ widthCm: "Width", depthCm: "Depth", heightCm: "Height" }[k]} (cm)
                      <input type="number" inputMode="decimal" className={inputCls + " mt-1 tabular-nums"} value={spec[k]}
                        onChange={(e) => set({ [k]: Number(e.target.value), dimsSource: "typed" })} />
                    </label>
                  ))}
                </div>
                <p className={`rounded-lg px-3 py-2 text-[13px] ${spec.dimsSource === "estimated" ? "bg-warn-soft text-warn" : "bg-fit-soft text-fit"}`}>
                  {spec.dimsSource === "estimated" ? "Size is a guess from the photo. Type the real size from the listing: the picture is only as right as these numbers." : spec.dimsSource === "printed" ? "Size read from the listing." : "Size typed in."}
                  {spec.notes && <span className="mt-0.5 block text-[12px] opacity-80">{spec.notes}</span>}
                </p>
                <label className="block text-[12px] text-muted">Shape
                  <select className={inputCls + " mt-1"} value={spec.shape} onChange={(e) => set({ shape: e.target.value as Shape })}>
                    {SHAPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
                {spec.shape !== "straight" && spec.shape !== "box" && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[12px] text-muted">Main seat depth (cm)<input type="number" className={inputCls + " mt-1"} value={spec.seatDepthCm ?? 90} onChange={(e) => set({ seatDepthCm: Number(e.target.value) })} /></label>
                    <label className="text-[12px] text-muted">Corner/chaise width (cm)<input type="number" className={inputCls + " mt-1"} value={spec.returnWidthCm ?? 90} onChange={(e) => set({ returnWidthCm: Number(e.target.value) })} /></label>
                  </div>
                )}
                {spec.shape !== "box" && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[12px] text-muted">Seats along the back<input type="number" min={1} max={8} className={inputCls + " mt-1"} value={spec.seatsBack ?? ""} onChange={(e) => set({ seatsBack: Number(e.target.value) || undefined })} /></label>
                    {spec.shape !== "straight" && <label className="text-[12px] text-muted">Seats on the {spec.shape.startsWith("chaise") ? "chaise" : "corner side"}<input type="number" min={1} max={6} className={inputCls + " mt-1"} value={spec.seatsReturn ?? ""} onChange={(e) => set({ seatsReturn: Number(e.target.value) || undefined })} /></label>}
                  </div>
                )}
                <details className="text-[13px]">
                  <summary className="cursor-pointer text-muted">What makes it this one ({spec.identity.length} details Gemini must keep)</summary>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted">{spec.identity.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  {spec.leaveOut && !/^none/i.test(spec.leaveOut) && <p className="mt-2 text-muted">Left out: {spec.leaveOut}</p>}
                </details>
              </div>
            )}
          </div>
        </div>
      </Step>

      {/* 2 · the room photo */}
      <Step n={2} title="The room" hint="Each photo is lined up with the room’s measured plan once, so it knows how big a metre is anywhere in it.">
        <div className="mb-3 flex flex-wrap gap-2">
          {rooms.filter((r) => plans[r.id]).map((r) => (
            <button key={r.id} onClick={() => setRoomId(r.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${r.id === roomId ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-ink"}`}>{r.name}</button>
          ))}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {roomViews.map((v) => (
            <div key={v.id} className="relative shrink-0">
              <button onClick={() => setViewId(v.id)} className={`block h-28 overflow-hidden rounded-xl ${v.id === viewId ? "ring-4 ring-accent" : "ring-1 ring-line"}`}>
                <img src={fileUrl(v.file)} alt="Room photo" className="h-full w-auto" />
              </button>
              <button onClick={() => forgetView(v.id)} title="Don’t use this photo" className="absolute right-1.5 top-1.5 rounded-full bg-ink/70 px-1.5 text-xs text-paper">✕</button>
            </div>
          ))}
          {queue.length > 0 && (
            <div className="flex h-28 w-40 shrink-0 flex-col items-center justify-center rounded-xl bg-sunken px-3 text-center text-[12px] text-muted">
              <span className="mb-1 size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Measuring {queue.length} photo{queue.length > 1 ? "s" : ""} of this room… (about 20s each, only ever once)
            </div>
          )}
          <label className={`flex h-28 w-36 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line px-3 text-center text-[12px] text-muted hover:bg-sunken ${measuring ? "opacity-60" : ""}`}>
            {measuring === "upload" ? "Measuring… (about 20s)" : "Add another photo of this room"}
            <span className="mt-1 text-[11px] text-faint">from a corner, showing two walls, floor and ceiling</span>
            <input type="file" accept="image/*" hidden disabled={!!measuring} onChange={(e) => e.target.files?.[0] && measurePhoto(e.target.files[0])} />
          </label>
        </div>
      </Step>

      {/* 3 · place it */}
      {spec && plan && view && pos && (
        <Step n={3} title="Put it where it would go" hint="Drag it on the plan. The grey block on the photo is its real size from this camera.">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="space-y-3">
              <PlanEditor plan={plan} spec={spec} pos={pos} onChange={setPos} />
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setPos({ ...pos, rot: (pos.rot + 90) % 360 })}>Turn 90°</Button>
                <Button variant="ghost" onClick={() => setPos(snap(plan, spec, pos))}>Back against the wall</Button>
              </div>
              <FitNote plan={plan} spec={spec} pos={pos} />
            </div>
            <PhotoPreview view={view} spec={spec} pos={pos} plan={plan} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={draw} disabled={busy || !itemFile}>{busy ? "Drawing…" : "Draw it in the room"}</Button>
            <span className="text-sm text-muted">{busy ? `${stage} (about a minute)` : "About a minute. Uses Gemini."}</span>
          </div>
        </Step>
      )}

      {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}

      {result && (
        <section className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-sunken">
            <img src={fileUrl(showBefore ? views.find((v) => v.id === result.viewId)?.file ?? result.result : result.result)} alt={`${result.title} in the room`} className="w-full" />
            <button onPointerDown={() => setShowBefore(true)} onPointerUp={() => setShowBefore(false)} onPointerLeave={() => setShowBefore(false)}
              className="absolute bottom-3 left-3 rounded-full bg-ink/75 px-3 py-1.5 text-xs text-paper backdrop-blur">Hold to see the room before</button>
          </div>
          <Checks r={result} />
        </section>
      )}

      {renders.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-2xl">Tried so far</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {renders.map((r) => (
              <button key={r.id} onClick={() => { setResult(r); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="overflow-hidden rounded-xl border border-line bg-surface text-left hover:ring-2 hover:ring-accent">
                <img src={fileUrl(r.result)} alt="" className="aspect-[4/3] w-full object-cover" />
                <p className="truncate px-2.5 pt-2 text-sm font-medium">{r.title}</p>
                <p className="px-2.5 pb-2 text-[12px] text-muted">{r.spec.widthCm}×{r.spec.depthCm} cm · {rooms.find((x) => x.id === r.roomId)?.name}{r.addedBy ? ` · ${r.addedBy}` : ""}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-display text-2xl text-accent">{n}</span>
        <div><h2 className="font-display text-xl">{title}</h2><p className="text-[13px] text-muted">{hint}</p></div>
      </div>
      {children}
    </section>
  );
}

function snap(plan: RoomPlan, spec: ItemSpec, pos: Pos): Pos {
  // nearest wall to the item's back edge, keeping its place along that wall
  const back = footprint(sizeOf(spec), toPlacement(pos, spec)).slice(0, 2);
  const mid = [(back[0][0] + back[1][0]) / 2, (back[0][1] + back[1][1]) / 2];
  let best = { wi: 0, d: Infinity, along: 0 };
  for (const w of walls(plan)) {
    const along = Math.max(spec.widthCm / 200, Math.min(w.len - spec.widthCm / 200, (mid[0] - w.a[0]) * w.t[0] + (mid[1] - w.a[1]) * w.t[1]));
    const p = [w.a[0] + w.t[0] * along, w.a[1] + w.t[1] * along], d = Math.hypot(mid[0] - p[0], mid[1] - p[1]);
    if (w.len >= spec.widthCm / 100 * 0.6 && d < best.d) best = { wi: w.i, d, along };
  }
  return againstWall(plan, best.wi, spec, best.along);
}

function PlanEditor({ plan, spec, pos, onChange }: { plan: RoomPlan; spec: ItemSpec; pos: Pos; onChange: (p: Pos) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const pad = 0.3, vb = `${-pad} ${-pad} ${plan.width + 2 * pad} ${plan.depth + 2 * pad}`;
  const fp = footprint(sizeOf(spec), toPlacement(pos, spec));
  const blocks = massing(sizeOf(spec), toPlacement(pos, spec));
  const toPlan = (e: React.PointerEvent) => { const m = svg.current!.getScreenCTM()!.inverse(); const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return [p.x, p.y]; };
  return (
    <svg ref={svg} viewBox={vb} className="w-full touch-none rounded-xl bg-sunken"
      onPointerMove={(e) => { if (!drag.current) return; const [x, y] = toPlan(e); onChange({ ...pos, cx: +(x - drag.current.dx).toFixed(3), cy: +(y - drag.current.dy).toFixed(3) }); }}
      onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}>
      <polygon points={plan.points.map((p) => p.join(",")).join(" ")} fill="var(--color-surface, #fff)" stroke="currentColor" strokeWidth={0.04} className="text-ink" />
      {plan.edges.map((e, i) => {
        const a = plan.points[i], b = plan.points[(i + 1) % plan.points.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return e.openings.map((o, j) => {
          const p = [a[0] + ((b[0] - a[0]) * o.from) / len, a[1] + ((b[1] - a[1]) * o.from) / len], q = [a[0] + ((b[0] - a[0]) * o.to) / len, a[1] + ((b[1] - a[1]) * o.to) / len];
          return <line key={`${i}-${j}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={o.kind === "door" ? "#c2410c" : "#0284c7"} strokeWidth={0.09} />;
        });
      })}
      {blocks.map((v, i) => <polygon key={i} points={v.slice(0, 4).map((p) => `${p[0]},${p[1]}`).join(" ")} fill="rgba(120,120,120,.35)" stroke="none" />)}
      <polygon points={fp.map((p) => p.join(",")).join(" ")} fill="rgba(217,119,6,.18)" stroke="#d97706" strokeWidth={0.03} className="cursor-move"
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); const [x, y] = toPlan(e); drag.current = { dx: x - pos.cx, dy: y - pos.cy }; }} />
      {/* the front edge, so you can see which way it faces */}
      <line x1={fp[2][0]} y1={fp[2][1]} x2={fp[3][0]} y2={fp[3][1]} stroke="#d97706" strokeWidth={0.07} strokeLinecap="round" pointerEvents="none" />
    </svg>
  );
}

function FitNote({ plan, spec, pos }: { plan: RoomPlan; spec: ItemSpec; pos: Pos }) {
  const fp = footprint(sizeOf(spec), toPlacement(pos, spec));
  const out = fp.some((p) => !inside(plan, p));
  // the shortest gap from its front edge to the opposite wall: what is left to walk through
  const front = [(fp[2][0] + fp[3][0]) / 2, (fp[2][1] + fp[3][1]) / 2], dir = [fp[3][0] - fp[0][0], fp[3][1] - fp[0][1]], dl = Math.hypot(dir[0], dir[1]);
  let gap = Infinity;
  for (const w of walls(plan)) {
    const den = (dir[0] / dl) * -w.t[1] + (dir[1] / dl) * w.t[0];
    if (Math.abs(den) < 1e-6) continue;
    const s = ((w.a[0] - front[0]) * -w.t[1] + (w.a[1] - front[1]) * w.t[0]) / den;
    const hit = [front[0] + (dir[0] / dl) * s, front[1] + (dir[1] / dl) * s], along = (hit[0] - w.a[0]) * w.t[0] + (hit[1] - w.a[1]) * w.t[1];
    if (s > 0.01 && along >= -0.01 && along <= w.len + 0.01) gap = Math.min(gap, s);
  }
  return (
    <p className={`rounded-lg px-3 py-2 text-[13px] ${out ? "bg-warn-soft text-warn" : "bg-fit-soft text-fit"}`}>
      {out ? "It goes through a wall here. Move it or try a smaller size." : `Fits. ${isFinite(gap) ? `${Math.round(gap * 100)} cm clear in front of it.` : ""}`}
    </p>
  );
}

function PhotoPreview({ view, spec, pos, plan }: { view: TryView; spec: ItemSpec; pos: Pos; plan: RoomPlan }) {
  const { cam } = view;
  const polys = useMemo(() => facePolygons(cam, massing(sizeOf(spec), toPlacement(pos, spec))), [cam, spec, pos]);
  const [lines, setLines] = useState(false);
  const seg = (a: Vec3, b: Vec3) => {
    const p = project(cam, a), q = project(cam, b);
    return p[2] > 0.2 && q[2] > 0.2 ? `M${p[0].toFixed(0)},${p[1].toFixed(0)}L${q[0].toFixed(0)},${q[1].toFixed(0)}` : "";
  };
  const planPath = lines ? plan.points.flatMap((a, i) => {
    const b = plan.points[(i + 1) % plan.points.length], out: string[] = [];
    for (let t = 0; t < 1; t += 0.05) for (const z of [0, plan.ceiling])
      out.push(seg([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z], [a[0] + (b[0] - a[0]) * (t + 0.05), a[1] + (b[1] - a[1]) * (t + 0.05), z]));
    return out;
  }).join("") : "";
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl bg-sunken">
        <img src={fileUrl(view.file)} alt="Room photo" className="w-full" />
        <svg viewBox={`0 0 ${cam.W} ${cam.H}`} className="pointer-events-none absolute inset-0 size-full">
          {polys.map((p, i) => <polygon key={i} points={p.pts.map((q) => q.join(",")).join(" ")} fill={`rgba(${p.shade},${p.shade},${p.shade},.82)`} stroke="rgba(0,0,0,.35)" strokeWidth={cam.W / 500} strokeLinejoin="round" />)}
          {planPath && <path d={planPath} stroke="#06b6d4" strokeWidth={cam.W / 300} fill="none" />}
        </svg>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-muted">
        <input type="checkbox" checked={lines} onChange={(e) => setLines(e.target.checked)} />
        Show the measured walls on the photo (they should sit on the real ones; if not, remove this photo and add another)
      </label>
    </div>
  );
}

function Checks({ r }: { r: TryRender }) {
  const w = r.checks.widthErrPct, ok = w != null && Math.abs(w) <= 6;
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className={`rounded-xl px-4 py-3 text-sm ${w == null ? "bg-sunken text-muted" : ok ? "bg-fit-soft text-fit" : "bg-warn-soft text-warn"}`}>
        <b className="font-medium">{r.title}: {r.spec.widthCm} × {r.spec.depthCm} × {r.spec.heightCm} cm</b>
        <span className="block text-[13px] opacity-90">
          {w == null ? "Placed at its measured size (the double-check didn’t run)." : ok ? `Checked: drawn within ${Math.max(1, Math.round(Math.abs(w)))}% of its real width in this photo.` : `Careful: it came out ${w > 0 ? "wider" : "narrower"} than its real size by about ${Math.round(Math.abs(w))}%. Try again.`}
          {r.spec.dimsSource === "estimated" ? " The size itself was guessed from the photo." : ""}
        </span>
      </div>
      <a href={fileUrl(r.plate)} target="_blank" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-[12px] text-muted hover:bg-sunken">
        <img src={fileUrl(r.plate)} alt="" className="h-12 rounded" /> Gemini’s copy of your piece
      </a>
    </div>
  );
}
