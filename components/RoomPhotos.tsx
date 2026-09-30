"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomPhoto } from "@/lib/types";
import { fileUrl, uploadFile } from "@/lib/upload";
import { Avatar, timeAgo } from "./People";

/** Photos of the room as it is now: a strip of thumbnails, tap one to see it big. */
export function RoomPhotos({ roomId, roomName, photos: initial }: { roomId: string; roomName: string; photos: RoomPhoto[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setPhotos(initial), [initial]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    try {
      const names: string[] = [];
      for (const [i, f] of [...files].entries()) {
        setBusy(`Uploading ${i + 1} of ${files.length}…`);
        names.push(await uploadFile(f));
      }
      const res = await fetch(`/api/rooms/${roomId}/photos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files: names }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setPhotos([...(await res.json()), ...photos]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setBusy(null);
  }

  async function remove(id: string) {
    setPhotos((p) => p.filter((x) => x.id !== id));
    setOpen(null);
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">The room now</h2>
          <p className="text-sm text-muted">{photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : `Photos of the ${roomName.toLowerCase()} as it is today`}</p>
        </div>
        <label className={`cursor-pointer rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium transition hover:bg-sunken ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ?? "+ Add photos"}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {error && <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}

      {photos.length ? (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
          {photos.map((p, i) => (
            <button key={p.id} onClick={() => setOpen(i)} className="group relative aspect-[4/3] w-64 shrink-0 snap-start overflow-hidden rounded-2xl bg-sunken sm:w-72">
              <img src={fileUrl(p.file)} alt={p.caption || `${roomName} photo`} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              {p.addedBy && <span className="absolute bottom-2 left-2"><Avatar name={p.addedBy} size={22} /></span>}
            </button>
          ))}
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center hover:bg-surface">
          <span className="font-medium">Add photos of the {roomName.toLowerCase()}</span>
          <span className="text-sm text-muted">Everyone with the link will see them. Pick several at once.</span>
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      )}

      <Lightbox photos={photos} index={open} onIndex={setOpen} onDelete={remove} />
    </section>
  );
}

function Lightbox({ photos, index, onIndex, onDelete }: {
  photos: RoomPhoto[]; index: number | null; onIndex: (i: number | null) => void; onDelete: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const p = index == null ? null : photos[index];
  const step = useCallback((d: number) => index != null && onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex]);

  useEffect(() => { setConfirming(false); if (p) ref.current?.showModal(); else ref.current?.close(); }, [p]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); };
    if (p) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p, step]);

  return (
    <dialog ref={ref} onClose={() => onIndex(null)} className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/85">
      {p && (
        <div className="flex h-dvh w-screen flex-col text-white" onClick={(e) => e.target === e.currentTarget && onIndex(null)}>
          <div className="flex items-center justify-between gap-3 p-4 text-sm">
            <span className="flex items-center gap-2 opacity-80">
              {p.addedBy && <><Avatar name={p.addedBy} size={24} /> {p.addedBy} ·</>} {timeAgo(p.addedAt)} · {index! + 1} / {photos.length}
            </span>
            <div className="flex gap-2">
              {confirming ? (
                <button onClick={() => onDelete(p.id)} className="rounded-full bg-red-500/90 px-3 py-1.5">Yes, delete</button>
              ) : (
                <button onClick={() => setConfirming(true)} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">Delete</button>
              )}
              <button onClick={() => onIndex(null)} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20" aria-label="Close">✕</button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6" onClick={(e) => e.target === e.currentTarget && onIndex(null)}>
            <img src={fileUrl(p.file)} alt={p.caption || "Room photo"} className="max-h-full max-w-full rounded-lg object-contain" />
            {photos.length > 1 && (
              <>
                <button onClick={() => step(-1)} aria-label="Previous" className="absolute left-3 top-1/2 size-11 -translate-y-1/2 rounded-full bg-white/15 text-xl hover:bg-white/25">‹</button>
                <button onClick={() => step(1)} aria-label="Next" className="absolute right-3 top-1/2 size-11 -translate-y-1/2 rounded-full bg-white/15 text-xl hover:bg-white/25">›</button>
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
