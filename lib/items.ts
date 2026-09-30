import type { Item, ItemStatus } from "./types";

export const STATUS_STYLE: Record<ItemStatus, string> = {
  idea: "bg-sunken text-muted",
  "to-buy": "bg-accent-soft text-accent",
  ordered: "bg-warn-soft text-warn",
  have: "bg-fit-soft text-fit",
};

export const dimsText = (i: Pick<Item, "width_cm" | "depth_cm" | "height_cm">) =>
  [i.width_cm, i.depth_cm, i.height_cm].every((d) => d == null)
    ? null
    : [i.width_cm, i.depth_cm, i.height_cm].map((d) => (d == null ? "?" : Math.round(d))).join(" × ") + " cm";
