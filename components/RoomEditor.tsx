"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@/lib/types";
import { uploadFile } from "@/lib/upload";
import { ScanViewer, type Measured } from "./ScanViewer";
import { Button, Card, Label, inputCls } from "./ui";

export const ROOM_KINDS = ["living", "bedroom", "kitchen", "dining", "office", "bathroom", "hallway", "outdoor", "other"];

export function RoomEditor({ room }: { room: Room }) {
  const router = useRouter();
  const [draft, setDraft] = useState(room);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const onMeasured = useCallback((m: Measured) => setMeasured(m), []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(room);
  const setDim = (k: keyof Room["dims"], v: string) =>
    setDraft((d) => ({ ...d, dims: { ...d.dims, [k]: v === "" ? null : Number(v) } }));

  async function save() {
    setSaving(true);
    await fetch(`/api/rooms/${room.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    setSaving(false);
    router.refresh();
  }

  async function upload(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["glb", "gltf", "usdz", "obj"].includes(ext)) return setMsg("Upload a GLB export from your scanning app (USDZ and OBJ also work).");
    setUploading(true); setMsg(null);
    try {
      const scanFile = await uploadFile(file);
      const res = await fetch(`/api/rooms/${room.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ scanFile }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setDraft((d) => ({ ...d, scanFile }));
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    }
    setUploading(false);
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
    router.push("/rooms");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card className="p-4">
        {draft.scanFile ? (
          <ScanViewer src={`/api/files/${draft.scanFile}`} onMeasured={onMeasured} />
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl bg-sunken p-6 text-center">
            <p className="font-display text-xl">No scan yet</p>
            <p className="max-w-xs text-sm text-muted">Scan the room with Polycam, 3D Scanner App or any LiDAR app and export as <b>GLB</b>.</p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-line px-4 py-2.5 text-sm font-medium transition hover:bg-sunken">
            {uploading ? "Uploading…" : draft.scanFile ? "Replace scan" : "Upload scan"}
            <input type="file" hidden accept=".glb,.gltf,.usdz,.obj" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {measured && (
            <Button type="button" variant="quiet" onClick={() => setDraft((d) => ({ ...d, dims: measured }))}>
              Use scan measurements ({measured.width}×{measured.depth} cm)
            </Button>
          )}
        </div>
        {msg && <p className="mt-3 text-sm text-warn">{msg}</p>}
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <Label>Name</Label>
          <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div>
          <Label>Type</Label>
          <select className={inputCls} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
            {ROOM_KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <Label hint="cm">Dimensions</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["width", "depth", "height"] as const).map((k) => (
              <label key={k} className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-faint">{k}</span>
                <input className={`${inputCls} tabular-nums`} type="number" inputMode="numeric" min={0}
                  value={draft.dims[k] ?? ""} onChange={(e) => setDim(k, e.target.value)} />
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label>Notes for the shopper</Label>
          <textarea className={`${inputCls} min-h-24`} placeholder="Radiator under the window, want warm neutrals, cat-proof fabrics…"
            value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button type="button" variant="quiet" onClick={remove} onBlur={() => setConfirmDelete(false)} className="text-warn">
            {confirmDelete ? "Tap again to delete for everyone" : "Delete room"}
          </Button>
          <Button type="button" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button>
        </div>
      </Card>
    </div>
  );
}
