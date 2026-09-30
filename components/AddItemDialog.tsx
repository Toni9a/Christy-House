"use client";
import { useEffect, useRef, useState } from "react";
import { currencySymbol } from "@/lib/config";
import { ITEM_STATUSES, type Item, type ItemStatus, type Room } from "@/lib/types";
import { uploadFile } from "@/lib/upload";
import { Button, Label, inputCls } from "./ui";

/** Add something by hand — a thing already in the room, or one you've spotted. */
export function AddItemDialog(props: {
  open: boolean; onClose: () => void; onAdded: (item: Item) => void;
  rooms: Room[]; roomId: string | null; currency: string; defaultStatus?: ItemStatus;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (props.open) { setError(null); setPreview(null); ref.current?.showModal(); } else ref.current?.close();
  }, [props.open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = Object.fromEntries(new FormData(form)) as Record<string, FormDataEntryValue>;
    if (!String(fields.title ?? "").trim()) return setError("Give it a name, e.g. “Oak bed frame”.");
    setBusy(true); setError(null);
    try {
      const photo = fields.photo instanceof File && fields.photo.size > 0 ? await uploadFile(fields.photo) : null;
      delete fields.photo;
      const res = await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...fields, imageFile: photo }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      form.reset();
      setBusy(false);
      props.onAdded(data);
      props.onClose();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't add that. Try again.");
    }
  }

  return (
    <dialog ref={ref} onClose={props.onClose}
      className="m-auto w-[min(94vw,560px)] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-sm">
      <form onSubmit={submit} className="space-y-4 p-6">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-2xl">Add an idea</h2>
          <button type="button" onClick={props.onClose} className="text-muted hover:text-ink" aria-label="Close">✕</button>
        </div>

        <div className="flex gap-4">
          <label className="flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line text-center text-[11px] text-muted hover:bg-sunken/60">
            {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <span>Add<br />photo</span>}
            <input name="photo" type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
          </label>
          <div className="flex-1 space-y-3">
            <input name="title" required className={inputCls} placeholder="What is it? e.g. Oak bed frame" />
            <input name="url" type="url" className={inputCls} placeholder="Link (optional)" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Price</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{currencySymbol(props.currency)}</span>
              <input name="price" type="number" min={0} step="0.01" inputMode="decimal" className={`${inputCls} pl-8`} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <select name="status" defaultValue={props.defaultStatus ?? "idea"} className={inputCls}>
              {ITEM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <Label>Room</Label>
          <select name="roomId" defaultValue={props.roomId ?? ""} key={props.roomId} className={inputCls}>
            <option value="">No room</option>
            {props.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">Size (optional)</summary>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["width_cm", "depth_cm", "height_cm"] as const).map((k) => (
              <input key={k} name={k} type="number" min={0} inputMode="numeric" className={inputCls} placeholder={`${k.split("_")[0]} cm`} />
            ))}
          </div>
        </details>

        <textarea name="notes" className={`${inputCls} min-h-16`} placeholder="Notes — colour, where it goes, who it's from…" />

        {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={props.onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
        </div>
      </form>
    </dialog>
  );
}
