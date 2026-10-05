export type ManualFile = { file: string; name: string };
/** A labelled detail on an entry, e.g. "Unit rate: 28.39p per kWh". `secret` values (wifi passwords) are hidden until tapped. */
export type Fact = { label: string; value: string; secret?: boolean };
export type Manual = { id: string; title: string; category: string; notes: string; facts?: Fact[]; files: ManualFile[]; addedBy: string | null; addedAt: string };

export const MANUAL_CATEGORIES = ["Boiler", "Heating controls", "Electricity meter", "Gas meter", "Water", "Energy bills", "Broadband & wifi", "Appliance", "Other"];
/** Categories that link across to the meter readings. */
export const METER_LINKED = ["Electricity meter", "Gas meter", "Energy bills"];
export const MANUAL_FILE_RE = /^[\w-]+\.(jpg|jpeg|png|webp|gif|heic|pdf)$/;
export const isPdf = (file: string) => file.toLowerCase().endsWith(".pdf");
