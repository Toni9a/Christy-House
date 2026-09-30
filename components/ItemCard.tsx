"use client";
import { useState } from "react";
import Link from "next/link";
import { money } from "@/lib/config";
import { ITEM_STATUSES, type Item, type ItemSocial, type ItemStatus, type Room } from "@/lib/types";
import { dimsText, STATUS_STYLE } from "@/lib/items";
import { Avatar } from "./People";

export function ItemCard(props: {
  item: Item;
  social: ItemSocial;
  rooms: Room[];
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
  selecting?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { item, social } = props;
  const [imgOk, setImgOk] = useState(Boolean(item.image_url));
  const [confirming, setConfirming] = useState(false);
  const loves = social.reactions.filter((r) => r.value === "love");
  const nopes = social.reactions.filter((r) => r.value === "nope").length;
  const dims = dimsText(item);

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-surface transition ${
      props.selected ? "border-accent ring-4 ring-accent-soft" : "border-line hover:shadow-[0_8px_30px_-14px_rgb(0_0_0/0.2)]"
    }`}>
      {props.selecting && (
        <button type="button" onClick={props.onSelect} aria-pressed={props.selected}
          aria-label={props.selected ? "Remove from comparison" : "Add to comparison"}
          className="absolute inset-0 z-10 cursor-pointer">
          <span className={`absolute right-3 top-3 grid size-7 place-items-center rounded-full border-2 text-sm font-bold ${
            props.selected ? "border-accent bg-accent text-accent-ink" : "border-white bg-black/25 text-transparent"
          }`}>✓</span>
        </button>
      )}

      <Link href={`/items/${item.id}`} className="relative block aspect-[4/3] overflow-hidden bg-sunken">
        {imgOk ? (
          <img src={item.image_url!} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)}
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center"><span className="font-display text-5xl text-faint">{item.title.slice(0, 1)}</span></div>
        )}
        {item.addedBy && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-surface/90 py-0.5 pl-0.5 pr-2 text-[11px] text-ink backdrop-blur">
            <Avatar name={item.addedBy} size={20} /> {item.addedBy}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/items/${item.id}`} className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-[15px] font-medium leading-snug group-hover:text-accent">{item.title}</h3>
          {item.price != null && <p className="shrink-0 font-display text-lg tabular-nums">{money(item.price, item.currency)}</p>}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          {item.source && <span>{item.source}</span>}
          {dims && <span className="rounded-md bg-sunken px-1.5 py-0.5 tabular-nums">{dims}</span>}
        </div>
        {item.notes && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">{item.notes}</p>}

        <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
          <label className="sr-only" htmlFor={`st-${item.id}`}>Status</label>
          <select id={`st-${item.id}`} value={item.status} onChange={(e) => props.onChange({ status: e.target.value as ItemStatus })}
            className={`cursor-pointer appearance-none rounded-full py-1 pl-3 pr-7 text-[12px] font-medium outline-none ${STATUS_STYLE[item.status]}`}
            style={{ backgroundImage: "linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%)", backgroundPosition: "right 12px center, right 8px center", backgroundSize: "4px 4px", backgroundRepeat: "no-repeat" }}>
            {ITEM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <Link href={`/items/${item.id}`} className="ml-auto flex items-center gap-3 whitespace-nowrap text-[12px] tabular-nums text-muted hover:text-ink">
            {loves.length > 0 && (
              <span className="flex items-center gap-1" title={`Loved by ${loves.map((l) => l.person).join(", ")}`}>
                <span className="text-accent">♥</span>{loves.length}
              </span>
            )}
            {nopes > 0 && <span className="whitespace-nowrap" title="Not for them">✕ {nopes}</span>}
            <span className="flex items-center gap-1" title="Comments">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" /></svg>
              {social.comments}
            </span>
          </Link>

          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full px-1.5 py-0.5 text-muted hover:bg-sunken hover:text-ink" aria-label="More">•••</summary>
            <div className="absolute bottom-8 right-0 z-20 w-52 space-y-1 rounded-xl border border-line bg-surface p-2 shadow-lg">
              <label className="block px-2 pt-1 text-[11px] uppercase tracking-wide text-faint" htmlFor={`rm-${item.id}`}>Move to</label>
              <select id={`rm-${item.id}`} value={item.roomId ?? ""} onChange={(e) => props.onChange({ roomId: e.target.value || null })}
                className="w-full rounded-lg bg-sunken px-2 py-1.5 text-[13px] outline-none">
                <option value="">No room</option>
                {props.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button type="button" onClick={() => (confirming ? props.onRemove() : setConfirming(true))}
                className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-warn hover:bg-warn-soft">
                {confirming ? "Tap again to remove for everyone" : "Remove item"}
              </button>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}
