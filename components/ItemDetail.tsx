"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { money } from "@/lib/config";
import { ITEM_STATUSES, type Comment, type Item, type ItemStatus, type Reaction, type ReactionValue, type Room } from "@/lib/types";
import { dimsText, STATUS_STYLE } from "@/lib/items";
import { Avatar, timeAgo } from "./People";
import { Button, Card, Label, inputCls } from "./ui";

type GoogleResult = { labels: string[]; hits: { title: string; url: string }[]; similar: string[] };

export function ItemDetail(props: {
  item: Item; rooms: Room[]; comments: Comment[]; reactions: Reaction[];
  who: string | null; baseUrl: string; googleEnabled: boolean;
}) {
  const router = useRouter();
  const [item, setItem] = useState(props.item);
  const [reactions, setReactions] = useState(props.reactions);
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(false);
  const room = props.rooms.find((r) => r.id === item.roomId) ?? null;
  const dims = dimsText(item);
  const fits = room?.dims.width && item.width_cm ? item.width_cm <= room.dims.width : null;

  async function save(patch: Partial<Item>) {
    setItem((i) => ({ ...i, ...patch }));
    await fetch(`/api/items/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    router.refresh();
  }

  async function react(value: ReactionValue) {
    if (!props.who) return window.dispatchEvent(new Event("who:change"));
    const mine = reactions.find((r) => r.person === props.who)?.value;
    const next = mine === value ? null : value;
    setReactions((rs) => [...rs.filter((r) => r.person !== props.who), ...(next ? [{ itemId: item.id, person: props.who!, value: next }] : [])]);
    await fetch(`/api/items/${item.id}/react`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: next }) });
    router.refresh();
  }

  const imageAbs = item.image_url ? (item.image_url.startsWith("/") ? props.baseUrl + item.image_url : item.image_url) : null;
  const mine = reactions.find((r) => r.person === props.who)?.value;
  const loves = reactions.filter((r) => r.value === "love");
  const nopes = reactions.filter((r) => r.value === "nope");

  return (
    <div className="space-y-8">
      <Link href={room ? `/rooms/${room.id}` : "/items"} className="text-sm text-muted hover:text-ink">← {room ? room.name : "All items"}</Link>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        {/* Photo */}
        <div className="space-y-3">
          <button onClick={() => item.image_url && setZoom(true)} className="block w-full overflow-hidden rounded-3xl bg-sunken" aria-label="See photo full size">
            {item.image_url
              ? <img src={item.image_url} alt={item.title} referrerPolicy="no-referrer" className="max-h-[70vh] w-full object-contain" />
              : <div className="grid aspect-[4/3] place-items-center font-display text-7xl text-faint">{item.title[0]}</div>}
          </button>
          {item.addedBy && (
            <p className="flex items-center gap-2 text-sm text-muted"><Avatar name={item.addedBy} size={22} /> Added by {item.addedBy} · {timeAgo(item.addedAt)}</p>
          )}
        </div>

        {/* Facts + actions */}
        <div className="space-y-6">
          {editing ? (
            <EditForm item={item} onCancel={() => setEditing(false)} onSave={(p) => { save(p); setEditing(false); }} />
          ) : (
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="font-display text-3xl leading-tight sm:text-4xl">{item.title}</h1>
                <button onClick={() => setEditing(true)} className="shrink-0 rounded-full px-3 py-1 text-sm text-muted hover:bg-sunken hover:text-ink">Edit</button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {item.price != null && <span className="font-display text-3xl tabular-nums">{money(item.price, item.currency)}</span>}
                {dims && <span className="rounded-md bg-sunken px-2 py-0.5 tabular-nums text-muted">{dims}</span>}
                {fits === true && <span className="rounded-md bg-fit-soft px-2 py-0.5 font-medium text-fit">Fits the {room!.name.toLowerCase()}</span>}
                {fits === false && <span className="rounded-md bg-warn-soft px-2 py-0.5 font-medium text-warn">Wider than the room</span>}
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-accent underline underline-offset-2">
                  View on {item.source || "the shop’s site"} ↗
                </a>
              )}
              {item.notes && <p className="mt-3 text-[15px] leading-relaxed text-muted">{item.notes}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <select aria-label="Status" value={item.status} onChange={(e) => save({ status: e.target.value as ItemStatus })}
              className={`rounded-full border-0 px-3.5 py-2 text-sm font-medium outline-none ${STATUS_STYLE[item.status]}`}>
              {ITEM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select aria-label="Room" value={item.roomId ?? ""} onChange={(e) => save({ roomId: e.target.value || null })}
              className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm outline-none">
              <option value="">No room</option>
              {props.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {/* Reactions */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => react("love")} aria-pressed={mine === "love"}
                className={`rounded-xl px-3 py-3 text-sm font-medium transition ${mine === "love" ? "bg-accent text-accent-ink" : "bg-sunken hover:bg-accent-soft hover:text-accent"}`}>
                ♥ Love it
              </button>
              <button onClick={() => react("nope")} aria-pressed={mine === "nope"}
                className={`rounded-xl px-3 py-3 text-sm font-medium transition ${mine === "nope" ? "bg-ink text-paper" : "bg-sunken hover:bg-line"}`}>
                ✕ Not for me
              </button>
            </div>
            {(loves.length > 0 || nopes.length > 0) && (
              <div className="mt-3 space-y-1.5 text-[13px] text-muted">
                {loves.length > 0 && <PeopleLine label="Loved by" names={loves.map((r) => r.person)} />}
                {nopes.length > 0 && <PeopleLine label="Not for" names={nopes.map((r) => r.person)} />}
              </div>
            )}
          </Card>

          <CheckPanel item={item} imageAbs={imageAbs} googleEnabled={props.googleEnabled} />
        </div>
      </div>

      <Comments itemId={item.id} initial={props.comments} who={props.who} />

      {zoom && item.image_url && (
        <div role="dialog" aria-label="Photo" onClick={() => setZoom(false)} className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/90 p-4">
          <img src={item.image_url} alt={item.title} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

function PeopleLine({ label, names }: { label: string; names: string[] }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5">
      <span>{label}</span>
      {names.map((n) => <span key={n} className="flex items-center gap-1 text-ink"><Avatar name={n} size={18} />{n}</span>)}
    </p>
  );
}

function EditForm({ item, onSave, onCancel }: { item: Item; onSave: (p: Partial<Item>) => void; onCancel: () => void }) {
  const [f, setF] = useState({ title: item.title, price: item.price?.toString() ?? "", url: item.url, notes: item.notes });
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      onSave({ title: f.title.trim() || item.title, price: f.price === "" ? null : Number(f.price), url: f.url.trim(), notes: f.notes });
    }}>
      <div><Label>Name</Label><input id="e-title" className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Price</Label><input id="e-price" className={inputCls} type="number" min={0} step="0.01" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
        <div><Label>Link</Label><input id="e-url" className={inputCls} type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></div>
      </div>
      <div><Label>Notes</Label><textarea id="e-notes" className={`${inputCls} min-h-20`} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit">Save</Button></div>
    </form>
  );
}

/** Ways to check the item: Google Lens, Google Shopping, a Google Vision lookup, and a Claude search for cheaper ones. */
function CheckPanel({ item, imageAbs, googleEnabled }: { item: Item; imageAbs: string | null; googleEnabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GoogleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/items/${item.id}/google`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (res.ok) setResult(data); else setError(data.error);
  }

  const btn = "flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-medium transition hover:bg-sunken";
  return (
    <Card className="space-y-3 p-4">
      <p className="text-[13px] font-medium">Check it</p>
      <div className="grid grid-cols-2 gap-2">
        {imageAbs && <a className={btn} href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageAbs)}`} target="_blank" rel="noopener noreferrer">Google Lens ↗</a>}
        <a className={btn} href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.title)}`} target="_blank" rel="noopener noreferrer">Google Shopping ↗</a>
        {googleEnabled && item.image_url && <button className={btn} onClick={check} disabled={busy}>{busy ? "Checking…" : "Where is this from?"}</button>}
        <Link className={`${btn} border-accent bg-accent-soft text-accent hover:bg-accent-soft`} href={`/find?item=${item.id}${item.roomId ? `&room=${item.roomId}` : ""}`}>Find it cheaper</Link>
      </div>
      {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
      {result && (
        <div className="space-y-3 border-t border-line pt-3 text-sm">
          {result.labels.length > 0 && <p><span className="text-muted">Google thinks this is:</span> <b className="font-medium">{result.labels.slice(0, 3).join(", ")}</b></p>}
          {result.hits.length > 0 ? (
            <div>
              <p className="mb-1.5 text-muted">Pages with the same picture</p>
              <ul className="space-y-1">
                {result.hits.slice(0, 6).map((h) => (
                  <li key={h.url} className="truncate"><a href={h.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:text-accent">{h.title}</a></li>
                ))}
              </ul>
            </div>
          ) : <p className="text-muted">No exact matches found online. Try Google Lens for similar items.</p>}
          {result.similar.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {result.similar.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="shrink-0"><img src={u} alt="" referrerPolicy="no-referrer" className="size-16 rounded-lg object-cover" /></a>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const QUICK = ["Love this colour", "Not keen on the colour", "Found it cheaper: ", "Will it fit?", "Comes in other colours?"];
const linkify = (text: string) =>
  text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline underline-offset-2">{part}</a>
      : part);

function Comments({ itemId, initial, who }: { itemId: string; initial: Comment[]; who: string | null }) {
  const router = useRouter();
  const [comments, setComments] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setComments(initial), [initial]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!who) return window.dispatchEvent(new Event("who:change"));
    if (!text.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/items/${itemId}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: text }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setComments((c) => [...c, data]);
    setText("");
    router.refresh();
  }
  async function remove(id: string) {
    setComments((c) => c.filter((x) => x.id !== id));
    await fetch(`/api/items/${itemId}/comments?comment=${id}`, { method: "DELETE" });
  }

  return (
    <section className="max-w-2xl">
      <h2 className="mb-4 font-display text-2xl">What everyone thinks <span className="text-base text-muted tabular-nums">{comments.length || ""}</span></h2>
      {comments.length === 0 && <p className="mb-4 text-sm text-muted">No comments yet. Say what you think, or share a cheaper link.</p>}
      <ol className="space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={c.author} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px]"><b className="font-medium">{c.author}</b> <span className="text-faint">· {timeAgo(c.createdAt)}</span>
                {c.author === who && <button onClick={() => remove(c.id)} className="ml-2 text-faint hover:text-warn">Delete</button>}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{linkify(c.body)}</p>
            </div>
          </li>
        ))}
      </ol>

      <form onSubmit={post} className="mt-6 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => { setText(q); box.current?.focus(); }}
              className="rounded-full border border-line px-3 py-1 text-[12px] text-muted hover:border-faint hover:text-ink">{q.replace(/: $/, "…")}</button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea id="comment" ref={box} value={text} onChange={(e) => setText(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(e); }}
            placeholder={who ? `Comment as ${who}…` : "Add a comment…"} className={`${inputCls} min-h-12 flex-1 resize-y`} />
          <Button type="submit" disabled={busy || !text.trim()}>{busy ? "…" : "Post"}</Button>
        </div>
        {error && <p className="text-sm text-warn">{error}</p>}
      </form>
    </section>
  );
}
