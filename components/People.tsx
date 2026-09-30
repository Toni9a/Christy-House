"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, inputCls } from "./ui";

/** Soft, stable colour per person so you can tell who said what at a glance. */
const HUES = [18, 145, 265, 330, 200, 45, 100];
const hueOf = (name: string) => HUES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length];

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const h = hueOf(name);
  return (
    <span title={name} aria-label={name}
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-surface"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${h} 45% 88%)`, color: `hsl(${h} 45% 30%)` }}>
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

export function setWhoCookie(name: string) {
  document.cookie = `who=${encodeURIComponent(name.trim())}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Asks "who's this?" once per device, so photos, loves and comments carry a name.
 * `known` are names already used in the house, offered as one-tap choices.
 */
export function WhoPrompt({ who, known }: { who: string | null; known: string[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(!who);

  useEffect(() => {
    const onChange = () => setOpen(true);
    window.addEventListener("who:change", onChange);
    return () => window.removeEventListener("who:change", onChange);
  }, []);
  useEffect(() => { if (open) ref.current?.showModal(); else ref.current?.close(); }, [open]);

  function save(n: string) {
    if (!n.trim()) return;
    setWhoCookie(n);
    setOpen(false);
    router.refresh();
  }

  return (
    <dialog ref={ref} onCancel={(e) => { if (!who) e.preventDefault(); else setOpen(false); }}
      className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-sm">
      <form onSubmit={(e) => { e.preventDefault(); save(name); }} className="space-y-4 p-6">
        <div>
          <h2 className="font-display text-2xl">Who’s this?</h2>
          <p className="mt-1 text-sm text-muted">Your name goes on the photos you add and your comments, so everyone knows who suggested what.</p>
        </div>
        {known.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {known.map((k) => (
              <button key={k} type="button" onClick={() => save(k)}
                className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm hover:border-ink">
                <Avatar name={k} /> {k}
              </button>
            ))}
          </div>
        )}
        <input id="who-name" autoFocus className={inputCls} placeholder="Your first name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex justify-end gap-2">
          {who && <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}
          <Button type="submit" disabled={!name.trim()}>That’s me</Button>
        </div>
      </form>
    </dialog>
  );
}

export const timeAgo = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  if (m < 60 * 24 * 14) return `${Math.round(m / 1440)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
