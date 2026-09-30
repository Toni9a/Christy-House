"use client";
import { useEffect, useRef, useState } from "react";

/** Drop, click, or paste (⌘V) an image. */
export function Dropzone(props: { preview: string | null; onFile: (f: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) props.onFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [props]);

  if (props.preview) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-line bg-sunken">
        <img src={props.preview} alt="Reference" className="max-h-64 w-full object-contain" />
        <button type="button" onClick={() => props.onFile(null)}
          className="absolute right-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs text-paper backdrop-blur hover:bg-ink">
          Remove
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        const f = e.dataTransfer.files[0];
        if (f?.type.startsWith("image/")) props.onFile(f);
      }}
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
        over ? "border-accent bg-accent-soft" : "border-line hover:border-faint hover:bg-sunken/60"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-7 text-faint" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" />
      </svg>
      <span className="text-sm font-medium">Drop a photo, or tap to choose</span>
      <span className="text-xs text-muted">Screenshots work great · you can also paste</span>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => props.onFile(e.target.files?.[0] ?? null)} />
    </button>
  );
}
