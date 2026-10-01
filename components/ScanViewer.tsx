"use client";
import { useEffect, useRef, useState } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string; "ios-src"?: string; ar?: boolean; "camera-controls"?: boolean; "shadow-intensity"?: string;
        exposure?: string; "camera-orbit"?: string; "interaction-prompt"?: string; "field-of-view"?: string;
      };
    }
  }
}

type ModelViewerEl = HTMLElement & { getDimensions(): { x: number; y: number; z: number } };
export type Measured = { width: number; depth: number; height: number };

/**
 * Renders a LiDAR export (GLB from Polycam / 3D Scanner App / RoomPlan→GLB) and
 * reads its bounding box. Scans are in metres; we report centimetres.
 */
export function ScanViewer({ src, onMeasured, lazy = false, sizeLabel, fallbackHref, iso = false, label }: {
  src: string; onMeasured?: (m: Measured) => void;
  /** Dollhouse view from a corner with a narrow lens, so it reads like an isometric drawing. */
  iso?: boolean;
  /** Shown over the model instead of the scan's own bounding box, e.g. the room's real size. */
  label?: string;
  /** Wait for a tap before downloading and drawing the model. Kinder to phones. */
  lazy?: boolean; sizeLabel?: string; fallbackHref?: string;
}) {
  const ref = useRef<ModelViewerEl>(null);
  const [ready, setReady] = useState(false);
  const [armed, setArmed] = useState(!lazy);
  const [failed, setFailed] = useState(false);
  const [dims, setDims] = useState<Measured | null>(null);
  const isUsdz = src.toLowerCase().endsWith(".usdz");

  useEffect(() => {
    if (!armed) return;
    import("@google/model-viewer").then(() => setReady(true)).catch(() => setFailed(true));
  }, [armed]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const onLoad = () => {
      const d = el.getDimensions();
      const m = { width: Math.round(d.x * 100), depth: Math.round(d.z * 100), height: Math.round(d.y * 100) };
      setDims(m);
      onMeasured?.(m);
    };
    const onError = () => setFailed(true);
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => { el.removeEventListener("load", onLoad); el.removeEventListener("error", onError); };
  }, [ready, src, onMeasured]);

  if (isUsdz) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl bg-sunken p-6 text-center">
        <p className="max-w-xs text-sm text-muted">USDZ files open in AR on iPhone, but can’t be previewed here. Export as <b>GLB</b> from your scanning app for the 3D view and auto-measure.</p>
        <a rel="ar" href={src} className="rounded-full bg-ink px-4 py-2 text-sm text-paper">Open in AR</a>
      </div>
    );
  }

  if (!armed) {
    return (
      <button onClick={() => setArmed(true)} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-sunken p-6 text-center transition hover:bg-line/50">
        <span className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper">View in 3D</span>
        <span className="text-xs text-muted">{sizeLabel ? `Loads a ${sizeLabel} model` : "Loads the 3D model"} · drag to look around</span>
      </button>
    );
  }

  if (failed) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl bg-sunken p-6 text-center">
        <p className="max-w-xs text-sm text-muted">This device couldn’t show the 3D model. It may be too heavy for the browser.</p>
        {fallbackHref && <a href={fallbackHref} download className="rounded-full bg-ink px-4 py-2 text-sm text-paper">Download it instead</a>}
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sunken">
      {ready ? (
        <model-viewer ref={ref} src={src} camera-controls shadow-intensity="0.6" exposure="1.05"
          camera-orbit={iso ? "40deg 52deg auto" : "30deg 60deg auto"} field-of-view={iso ? "18deg" : undefined} interaction-prompt="none"
          style={{ display: "block", width: "100%", height: "100%", background: "transparent", "--progress-bar-height": "0px" } as React.CSSProperties} />
      ) : (
        <div className="shimmer size-full" />
      )}
      {label ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-surface/90 px-3 py-1.5 text-xs tabular-nums backdrop-blur">{label}</div>
      ) : dims && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-surface/90 px-3 py-1.5 text-xs tabular-nums backdrop-blur">
          Scan bounds · {dims.width} × {dims.depth} cm · {dims.height} cm high
        </div>
      )}
    </div>
  );
}
