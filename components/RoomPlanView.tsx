"use client";
import { useMemo, useState } from "react";
import type { PlanOpening, RoomPlan } from "@/lib/room-plans";

const m = (n: number) => `${n.toFixed(2)} m`;
const letter = (i: number) => String.fromCharCode(65 + i);
const WINDOW = "#3b82c4";
const PAD = 0.75; // metres of margin around the outline, for the labels

type Sel = { kind: "wall"; i: number } | { kind: "open"; i: number; j: number } | null;

function inside(p: [number, number], poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * An annotated plan of one room: every wall lettered and measured, doors and windows marked, fixed units hatched.
 * Tap a wall or an opening to see its numbers (length, height, wall area, sill and head).
 */
export function RoomPlanView({ plan, roomName }: { plan: RoomPlan; roomName: string }) {
  const [sel, setSel] = useState<Sel>(null);
  const pts = plan.points;

  const geo = useMemo(() => pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d: [number, number] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    let n: [number, number] = [d[1], -d[0]];
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (inside([mid[0] + n[0] * 0.05, mid[1] + n[1] * 0.05], pts)) n = [-n[0], -n[1]];
    return { a, b, d, n, mid, len };
  }), [pts]);

  const at = (i: number, t: number): [number, number] => [geo[i].a[0] + geo[i].d[0] * t, geo[i].a[1] + geo[i].d[1] * t];
  const wallArea = (i: number) => {
    const gross = plan.edges[i].length * plan.ceiling;
    const cut = plan.edges[i].openings.reduce((s, o) => s + o.width * Math.min(o.head ?? plan.ceiling, plan.ceiling) - o.width * (o.sill ?? 0), 0);
    return { gross, net: gross - cut };
  };
  const openingText = (o: PlanOpening) => {
    const sill = o.sill == null ? "" : o.kind === "door" ? "" : ` · sill ${m(o.sill)} up`;
    const head = o.head == null ? (o.kind === "window" ? " · open above the scan’s reach" : "") : ` · ${o.kind === "door" ? "height" : "head"} ${m(o.head)}`;
    return `${o.label} · ${m(o.width)} wide${sill}${head}`;
  };

  const W = plan.width + PAD * 2, H = plan.depth + PAD * 2;
  const hl = "var(--accent)";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] tabular-nums text-muted">
        <span><b className="font-medium text-ink">{roomName}</b></span>
        <span>Ceiling {m(plan.ceiling)}</span>
        <span>Floor {plan.area.toFixed(1)} m²</span>
        <span>Longest {m(plan.depth)} × {m(plan.width)}</span>
      </div>

      <svg viewBox={`${-PAD} ${-PAD} ${W} ${H}`} className="w-full select-none rounded-2xl bg-sunken text-ink" role="img"
        aria-label={`Annotated plan of the ${roomName}`} style={{ maxHeight: 640 }} onClick={() => setSel(null)}>
        <defs>
          <pattern id="hatch" width="0.12" height="0.12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="0.12" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.02" />
          </pattern>
        </defs>

        <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="var(--surface)" />
        {plan.obstacles.map((o, k) => (
          <g key={k}>
            <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="url(#hatch)" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.015" />
            <text x={o.x + o.w / 2} y={o.y + o.h / 2} fontSize="0.13" textAnchor="middle" fill="currentColor" fillOpacity="0.75"
              transform={o.h > o.w * 1.6 ? `rotate(-90 ${o.x + o.w / 2} ${o.y + o.h / 2})` : undefined}>{o.label}</text>
          </g>
        ))}

        {geo.map((g, i) => {
          const on = sel?.kind === "wall" && sel.i === i;
          return (
            <g key={i}>
              <line x1={g.a[0]} y1={g.a[1]} x2={g.b[0]} y2={g.b[1]} stroke={on ? hl : "currentColor"} strokeWidth={on ? 0.1 : 0.07} strokeLinecap="square" />
              {plan.edges[i].openings.map((o, j) => {
                const p = at(i, o.from), q = at(i, o.to);
                const o_on = sel?.kind === "open" && sel.i === i && sel.j === j;
                return (
                  <g key={j}>
                    <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="var(--surface)" strokeWidth={0.1} />
                    <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={o.kind === "window" ? WINDOW : hl} strokeWidth={o_on ? 0.11 : 0.07}
                      strokeDasharray={o.kind === "door" ? "0.1 0.06" : undefined} />
                    <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="transparent" strokeWidth={0.3} className="cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setSel({ kind: "open", i, j }); }}><title>{openingText(o)}</title></line>
                    <text x={(p[0] + q[0]) / 2 - g.n[0] * 0.2} y={(p[1] + q[1]) / 2 - g.n[1] * 0.2 + 0.04} fontSize="0.12" textAnchor="middle"
                      fill={o.kind === "window" ? WINDOW : hl} stroke="var(--surface)" strokeWidth={0.05} paintOrder="stroke">{o.kind === "window" ? "window" : "door"} {m(o.width)}</text>
                  </g>
                );
              })}
              <line x1={g.a[0]} y1={g.a[1]} x2={g.b[0]} y2={g.b[1]} stroke="transparent" strokeWidth={0.28} className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setSel({ kind: "wall", i }); }}><title>{`Wall ${letter(i)}: ${m(plan.edges[i].length)}`}</title></line>
            </g>
          );
        })}

        {/* wall letters and lengths, outside the outline */}
        {geo.map((g, i) => {
          // Short walls get just their letter, so labels don't pile up; their lengths are in the list below.
          const short = g.len < 0.9;
          const off = short ? 0.26 : 0.38;
          const x = g.mid[0] + g.n[0] * off, y = g.mid[1] + g.n[1] * off;
          const on = sel?.kind === "wall" && sel.i === i;
          const txt = short ? letter(i) : `${letter(i)}  ${plan.edges[i].length.toFixed(2)}`;
          const w = short ? 0.2 : 0.6;
          return (
            <g key={i} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSel({ kind: "wall", i }); }}>
              <rect x={x - w / 2} y={y - 0.1} width={w} height={0.2} rx={0.1} fill={on ? hl : "var(--surface)"} stroke="var(--line)" strokeWidth={0.01} />
              <text x={x} y={y + 0.045} fontSize="0.125" textAnchor="middle" fill={on ? "var(--accent-ink)" : "currentColor"} className="tabular-nums" fontWeight={500}>{txt}</text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 min-h-[3.25rem] rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        {sel?.kind === "wall" ? (() => {
          const e = plan.edges[sel.i], a = wallArea(sel.i);
          return (
            <>
              <p><b className="font-medium">Wall {letter(sel.i)}</b> · <span className="tabular-nums">{m(e.length)} long · {m(plan.ceiling)} high</span></p>
              <p className="mt-0.5 text-[13px] tabular-nums text-muted">
                {a.gross.toFixed(1)} m² of wall{e.openings.length ? `, ${a.net.toFixed(1)} m² without its ${e.openings.map((o) => o.kind).join(" and ")}` : ""}
              </p>
              {e.openings.map((o, j) => <p key={j} className="mt-0.5 text-[13px] tabular-nums text-muted">{openingText(o)}</p>)}
            </>
          );
        })() : sel?.kind === "open" ? (
          <>
            <p><b className="font-medium">{openingText(plan.edges[sel.i].openings[sel.j]).split(" · ")[0]}</b> on wall {letter(sel.i)}</p>
            <p className="mt-0.5 text-[13px] tabular-nums text-muted">{openingText(plan.edges[sel.i].openings[sel.j]).split(" · ").slice(1).join(" · ")}</p>
            <p className="mt-0.5 text-[13px] tabular-nums text-muted">Starts {m(plan.edges[sel.i].openings[sel.j].from)} along wall {letter(sel.i)}, measured from the corner it shares with wall {letter((sel.i + plan.edges.length - 1) % plan.edges.length)}.</p>
          </>
        ) : (
          <p className="text-muted">Tap a wall or a door or window to see its length and height.</p>
        )}
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-1 text-[13px] tabular-nums sm:grid-cols-2">
        {plan.edges.map((e, i) => (
          <button key={i} onClick={() => setSel({ kind: "wall", i })}
            className={`flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-left ${sel?.kind === "wall" && sel.i === i ? "text-accent" : ""}`}>
            <span><b className="font-medium">{letter(i)}</b> <span className="text-muted">{e.openings.map((o) => `${o.kind} ${m(o.width)}`).join(", ")}</span></span>
            <span>{m(e.length)}</span>
          </button>
        ))}
      </div>

      {plan.notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-muted">{plan.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-faint">
        Measured from the Polycam scan to about 2 cm for walls and about 10 cm for window and door heights. Inside faces of the walls. Tape-measure before ordering anything tight.
      </p>
    </div>
  );
}
