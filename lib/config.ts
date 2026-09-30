export const config = {
  houseName: process.env.HOUSE_NAME || "Christy’s House",
  model: "claude-opus-5-5",
  country: process.env.HOME_COUNTRY || "GB",
  city: process.env.HOME_CITY || "London",
  currency: process.env.CURRENCY || "GBP",
  marketplaceCity: process.env.MARKETPLACE_CITY || "london",
  baseUrl: (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
};

export function money(n: number | null | undefined, currency = config.currency) {
  if (n == null) return "—";
  return new Intl.NumberFormat(config.country === "US" ? "en-US" : "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(n) || n >= 100 ? 0 : 2,
  }).format(n);
}

export const currencySymbol = (currency = config.currency) =>
  ({ GBP: "£", USD: "$", EUR: "€", AUD: "A$", CAD: "C$" })[currency] ?? currency + " ";
