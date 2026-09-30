"use client";
import { useEffect, useRef, useState } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string; "ios-src"?: string; ar?: boolean; "camera-controls"?: boolean; "shadow-intensity"?: string;
        exposure?: string; "camera-orbit"?: string; "interaction-prompt"?: string;
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
export function ScanViewer({ src, onMeasured }: { src: string; onMeasured?: (m: Measured) => void }) {
  const ref = useRef<ModelViewerEl>(null);
  const [ready, setReady] = useState(false);
  const [dims, setDims] = useState<Measured | null>(null);
  const isUsdz = src.toLowerCase().endsWith(".usdz");

  useEffect(() => {
    import("@google/model-viewer").then(() => setReady(true));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const onLoad = () => {
      const d = el.getDimensions();
      const m = { width: Math.round(d.x * 100), depth: Math.round(d.z * 100), height: Math.round(d.y * 100) };
      setDims(m);
      onMeasured?.(m);
    };
    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [ready, src, onMeasured]);

  if (isUsdz) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl bg-sunken p-6 text-center">
        <p className="max-w-xs text-sm text-muted">USDZ files open in AR on iPhone, but can’t be previewed here. Export as <b>GLB</b> from your scanning app for the 3D view and auto-measure.</p>
        <a rel="ar" href={src} className="rounded-full bg-ink px-4 py-2 text-sm text-paper">Open in AR</a>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sunken">
      {ready ? (
        <model-viewer ref={ref} src={src} camera-controls shadow-intensity="0.6" exposure="1.05"
          camera-orbit="30deg 60deg auto" interaction-prompt="none"
          style={{ display: "block", width: "100%", height: "100%", background: "transparent", "--progress-bar-height": "0px" } as React.CSSProperties} />
      ) : (
        <div className="shimmer size-full" />
      )}
      {dims && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-surface/90 px-3 py-1.5 text-xs tabular-nums backdrop-blur">
          Scan bounds · {dims.width} × {dims.depth} cm · {dims.height} cm high
        </div>
      )}
    </div>
  );
}
