"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROOM_KINDS } from "./RoomEditor";
import { Button, inputCls } from "./ui";

export function NewRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("living");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, kind }) });
    const room = await res.json();
    router.push(`/rooms/${room.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input className={inputCls} placeholder="Room name — e.g. Living room" value={name} onChange={(e) => setName(e.target.value)} />
      <select className={`${inputCls} sm:w-40`} value={kind} onChange={(e) => setKind(e.target.value)}>
        {ROOM_KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
      </select>
      <Button type="submit" disabled={busy || !name.trim()} className="shrink-0">Add room</Button>
    </form>
  );
}
