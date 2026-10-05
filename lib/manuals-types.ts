export type ManualFile = { file: string; name: string };
export type Manual = { id: string; title: string; category: string; notes: string; files: ManualFile[]; addedBy: string | null; addedAt: string };

export const MANUAL_CATEGORIES = ["Boiler", "Electricity meter", "Gas meter", "Water", "Heating controls", "Appliance", "Other"];
export const MANUAL_FILE_RE = /^[\w-]+\.(jpg|jpeg|png|webp|gif|heic|pdf)$/;
export const isPdf = (file: string) => file.toLowerCase().endsWith(".pdf");
