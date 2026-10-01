"use client";
import { useEffect, useRef, useState } from "react";
import type { Product, RoomPhoto } from "@/lib/types";
import { fileUrl, uploadFile } from "@/lib/upload";
import { Button } from "./ui";

/** Upload a room photo → Gemini renders the product into it. */
export function VisualizeDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bare, setBare] = useState<RoomPhoto[]>([]);

  useEffect(() => {
    if (product) {
      setResult(null); setError(null); ref.current?.showModal();
      fetch("/api/photos?kind=movein").then((r) => (r.ok ? r.json() : [])).then(setBare).catch(() => setBare([]));
    } else ref.current?.close();
  }, [product]);

  /** `source` is a new upload, or the stored name of a bare move-in photo. */
  async function run(source: File | string) {
    if (!product) return;
    setBusy(true); setError(null);
    try {
      const roomFile = typeof source === "string" ? source : await uploadFile(source);
      const res = await fetch("/api/visualize", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomFile, productImage: product.image_url, description: `${product.title}${product.width_cm ? `, ${product.width_cm} cm wide` : ""}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed");
    }
    setBusy(false);
  }

  return (
    <dialog ref={ref} onClose={onClose}
      className="m-auto w-[min(92vw,640px)] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-sm">
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">See it in your room</h2>
            <p className="mt-1 text-sm text-muted">{product?.title}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">✕</button>
        </div>
        {result ? (
          <img src={result} alt="Preview of the item in your room" className="w-full rounded-xl" />
        ) : (
          <>
          {bare.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-medium">Start from a bare room photo</p>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {bare.map((p) => (
                  <button key={p.id} disabled={busy} onClick={() => run(p.file)} className="aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-lg bg-sunken ring-accent hover:ring-2 disabled:opacity-60">
                    <img src={fileUrl(p.file)} alt="Bare room on move-in day" className="size-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-muted">…or upload a different photo:</p>
            </div>
          )}
          <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-10 text-center ${busy ? "opacity-60" : "hover:bg-sunken/60"}`}>
            <span className="text-sm font-medium">{busy ? "Rendering… (15–30s)" : "Upload a photo of the spot"}</span>
            <span className="text-xs text-muted">Gemini will place the item in it, matching light and perspective</span>
            <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
          </label>
          </>
        )}
        {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
        {result && <Button variant="ghost" onClick={() => setResult(null)}>Try another photo</Button>}
      </div>
    </dialog>
  );
}
