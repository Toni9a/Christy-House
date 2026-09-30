export type Dimensions = { width: number | null; depth: number | null; height: number | null }; // cm

export type Room = {
  id: string;
  name: string;
  kind: string; // living, bedroom, kitchen, dining, office, bathroom, other
  dims: Dimensions;
  notes: string;
  scanFile: string | null; // stored filename of the LiDAR export (.glb)
  createdAt: string;
};

export type SourceId =
  | "anywhere"
  | "amazon"
  | "marketplace"
  | "ebay"
  | "ikea"
  | "wayfair"
  | "johnlewis"
  | "dunelm"
  | "etsy"
  | "gumtree";

export type Filters = {
  minPrice: number;
  maxPrice: number;
  maxWidth: number | null; // cm — usually from the selected room
  closeness: number; // 0 = same vibe, 100 = exact dupe
  condition: "new" | "used" | "any";
  sources: SourceId[];
  roomId: string | null;
};

export type Product = {
  title: string;
  price: number | null;
  currency: string;
  url: string;
  source: string;
  image_url: string | null;
  width_cm: number | null;
  depth_cm: number | null;
  height_cm: number | null;
  condition: "new" | "used" | "unknown";
  match_score: number;
  why: string;
};

export type Identified = {
  name: string;
  category: string;
  style: string;
  materials: string[];
  colors: string[];
  search_terms: string[];
};

export type SearchChannel = "web" | "sms";

export type Search = {
  id: string;
  createdAt: string;
  channel: SearchChannel;
  status: "running" | "done" | "error";
  query: string;
  link: string | null;
  imageFile: string | null;
  filters: Filters;
  identified: Identified | null;
  summary: string | null;
  products: Product[];
  error: string | null;
};

/** Where an item is in its life: something you like → buying it → it's in the house. */
export type ItemStatus = "idea" | "to-buy" | "ordered" | "have";

export const ITEM_STATUSES: { value: ItemStatus; label: string }[] = [
  { value: "idea", label: "Ideas" },
  { value: "to-buy", label: "To buy" },
  { value: "ordered", label: "Ordered" },
  { value: "have", label: "Have it" },
];

/** A thing in (or wanted for) a room. Saved from a search, or added by hand. */
export type Item = Product & {
  id: string;
  roomId: string | null;
  status: ItemStatus;
  notes: string;
  addedBy: string | null;
  addedAt: string;
};

/** A photo of the room itself, as it is now. */
export type RoomPhoto = { id: string; roomId: string; file: string; caption: string; addedBy: string | null; addedAt: string };

export type Comment = { id: string; itemId: string; author: string; body: string; createdAt: string };

export type ReactionValue = "love" | "nope";
export type Reaction = { itemId: string; person: string; value: ReactionValue };

/** What an item card needs to show alongside the item. */
export type ItemSocial = { reactions: Reaction[]; comments: number };
