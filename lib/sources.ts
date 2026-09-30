import { config } from "./config";
import type { Filters, SourceId } from "./types";

type Source = {
  id: SourceId;
  label: string;
  domain: string | null; // used to steer Claude's web search
  used?: boolean; // second-hand marketplace
  link?: (q: string, f: Filters) => string; // hand-off search URL
};

const enc = encodeURIComponent;
const amazonTld = { GB: "co.uk", US: "com", DE: "de", FR: "fr", CA: "ca", AU: "com.au" }[config.country] ?? "com";
const ebayTld = { GB: "co.uk", US: "com", DE: "de", FR: "fr", CA: "ca", AU: "com.au" }[config.country] ?? "com";

export const SOURCES: Source[] = [
  { id: "anywhere", label: "Anywhere", domain: null },
  {
    id: "amazon",
    label: "Amazon",
    domain: `amazon.${amazonTld}`,
    link: (q, f) =>
      `https://www.amazon.${amazonTld}/s?k=${enc(q)}&rh=p_36%3A${f.minPrice * 100}-${f.maxPrice * 100}`,
  },
  {
    id: "marketplace",
    label: "FB Marketplace",
    domain: "facebook.com/marketplace",
    used: true,
    // Marketplace has no public API — we hand off a pre-filtered search instead.
    link: (q, f) =>
      `https://www.facebook.com/marketplace/${config.marketplaceCity}/search?query=${enc(q)}&minPrice=${f.minPrice}&maxPrice=${f.maxPrice}`,
  },
  {
    id: "ebay",
    label: "eBay",
    domain: `ebay.${ebayTld}`,
    used: true,
    link: (q, f) => `https://www.ebay.${ebayTld}/sch/i.html?_nkw=${enc(q)}&_udlo=${f.minPrice}&_udhi=${f.maxPrice}`,
  },
  { id: "ikea", label: "IKEA", domain: "ikea.com", link: (q) => `https://www.ikea.com/${config.country.toLowerCase()}/en/search/?q=${enc(q)}` },
  { id: "wayfair", label: "Wayfair", domain: config.country === "GB" ? "wayfair.co.uk" : "wayfair.com" },
  { id: "johnlewis", label: "John Lewis", domain: "johnlewis.com", link: (q) => `https://www.johnlewis.com/search?search-term=${enc(q)}` },
  { id: "dunelm", label: "Dunelm", domain: "dunelm.com", link: (q) => `https://www.dunelm.com/search?searchTerm=${enc(q)}` },
  { id: "etsy", label: "Etsy", domain: "etsy.com", link: (q, f) => `https://www.etsy.com/search?q=${enc(q)}&min=${f.minPrice}&max=${f.maxPrice}` },
  {
    id: "gumtree",
    label: "Gumtree",
    domain: "gumtree.com",
    used: true,
    link: (q, f) => `https://www.gumtree.com/search?q=${enc(q)}&min_price=${f.minPrice}&max_price=${f.maxPrice}`,
  },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);

/** One-tap search links for the sources we can't query directly (or to browse further). */
export function handoffLinks(query: string, f: Filters) {
  const wanted = f.sources.includes("anywhere") || f.sources.length === 0 ? SOURCES : SOURCES.filter((s) => f.sources.includes(s.id));
  return wanted
    .filter((s) => s.link && !(f.condition === "new" && s.used))
    .map((s) => ({ id: s.id, label: s.label, url: s.link!(query, f) }));
}
