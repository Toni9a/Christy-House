"use client";
import { useState } from "react";
import { money } from "@/lib/config";
import type { Product } from "@/lib/types";

export function ProductCard(props: {
  product: Product;
  maxWidth: number | null;
  saved?: boolean;
  /** Save to a room. With `roomId` set it's one tap; otherwise you pick the room. */
  onSave?: (roomId: string | null) => Promise<void> | void;
  rooms?: { id: string; name: string }[];
  roomId?: string | null;
  onVisualize?: () => void;
}) {
  const p = props.product;
  const [imgOk, setImgOk] = useState(Boolean(p.image_url));
  const [saved, setSaved] = useState(Boolean(props.saved));
  const fits = props.maxWidth && p.width_cm ? p.width_cm <= props.maxWidth : null;
  const dims = [p.width_cm, p.depth_cm, p.height_cm].every((d) => d == null)
    ? null
    : [p.width_cm, p.depth_cm, p.height_cm].map((d) => (d == null ? "?" : Math.round(d))).join(" × ") + " cm";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.18)]">
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/3] overflow-hidden bg-sunken">
        {imgOk ? (
          <img src={p.image_url!} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)}
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="font-display text-5xl text-faint">{p.source.slice(0, 1)}</span>
          </div>
        )}
        <span className="absolute left-3 top-3 max-w-[55%] truncate rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur">
          {p.source}{p.condition === "used" ? " · used" : ""}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2 py-1 text-[11px] font-semibold tabular-nums text-paper backdrop-blur">
          {Math.round(p.match_score)}% match
        </span>
      </a>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-[15px] font-medium leading-snug">{p.title}</h3>
          <p className="shrink-0 font-display text-lg tabular-nums">{money(p.price, p.currency)}</p>
        </div>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">{p.why}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-[12px]">
          {dims && <span className="rounded-md bg-sunken px-2 py-0.5 tabular-nums text-muted">{dims}</span>}
          {fits === true && <span className="rounded-md bg-fit-soft px-2 py-0.5 font-medium text-fit">Fits</span>}
          {fits === false && <span className="rounded-md bg-warn-soft px-2 py-0.5 font-medium text-warn">Too wide</span>}
        </div>

        <div className="flex gap-2 border-t border-line pt-3">
          <a href={p.url} target="_blank" rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-ink px-3 py-2 text-center text-[13px] font-medium text-paper transition hover:opacity-90">
            View ↗
          </a>
          {props.onSave && (saved || props.roomId || !props.rooms?.length ? (
            <button type="button" aria-pressed={saved} title={saved ? "Saved" : "Save to the room's items"}
              onClick={async () => { if (!saved) { setSaved(true); await props.onSave!(props.roomId ?? null); } }}
              className={`rounded-lg border px-3 py-2 text-[13px] transition ${saved ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`}>
              {saved ? "♥ Saved" : "♡ Save"}
            </button>
          ) : (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-2 text-[13px] text-muted transition hover:text-ink">♡ Save</summary>
              <div className="absolute bottom-11 right-0 z-20 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-faint">Save to</p>
                {props.rooms.map((r) => (
                  <button key={r.id} type="button" onClick={async () => { setSaved(true); await props.onSave!(r.id); }}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-sunken">{r.name}</button>
                ))}
              </div>
            </details>
          ))}
          {props.onVisualize && (
            <button type="button" onClick={props.onVisualize} title="Preview it in your room"
              className="rounded-lg border border-line px-3 py-2 text-[13px] text-muted transition hover:text-ink">
              ✦
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="shimmer aspect-[4/3]" />
      <div className="space-y-2.5 p-4">
        <div className="shimmer h-4 w-4/5 rounded" />
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}
