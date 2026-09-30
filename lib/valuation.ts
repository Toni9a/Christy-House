/**
 * The house's working valuation (desktop estimate, researched 21 Sep 2026).
 * Update these figures when you have newer evidence; the Value page reads only this file.
 */
export const valuation = {
  address: "10 Amherst Close",
  area: "Orpington",
  postcode: "BR5 2HH",
  asOf: "21 Sep 2026",
  estimate: 410_000,
  low: 395_000,
  high: 430_000,
  confidence: "Medium",
  facts: [
    { value: "2", label: "Bedrooms" },
    { value: "1", label: "Bathroom" },
    { value: "86 m²", label: "Floor area" },
    { value: "Freehold", label: "Tenure" },
  ],
  bedroomNote:
    "This valuation uses the 2-bedroom record. Another property source describes 3 bedrooms, so confirm the layout before relying on the estimate.",

  comparables: [
    { address: "167 Amherst Drive", type: "2-bed semi", price: 409_000, date: "10 Oct 2024", weight: "strong", url: "https://www.rightmove.co.uk/house-prices/br5/amherst-drive.html" },
    { address: "7 Sayes Court Road", type: "2-bed semi", price: 370_000, date: "20 Aug 2025", weight: "strong", url: "https://www.rightmove.co.uk/house-prices/br5/sayes-court-road.html" },
    { address: "15 Furzehill Square", type: "2-bed terrace", price: 410_000, date: "1 Jul 2025", weight: "supporting", url: "https://www.rightmove.co.uk/house-prices/br5/furzehill-square.html" },
    { address: "32 Sayes Court Road", type: "2-bed terrace", price: 380_000, date: "7 Jul 2025", weight: "supporting", url: "https://www.rightmove.co.uk/house-prices/br5/sayes-court-road.html" },
    { address: "22 Amherst Close", type: "Auction sale", price: 287_500, date: "2025", weight: "caution", url: "https://propertyauctions.io/listings/f6900180bb4041067cfdc99d66e82a7d",
      why: "Auction sale of a smaller home needing updating; not a like-for-like market sale." },
    { address: "6 Amherst Close", type: "Older sale", price: 363_500, date: "Jan 2021", weight: "caution", url: "https://www.zoopla.co.uk/house-prices/orpington/amherst-close/",
      why: "Similar size, but the sale is older and bedroom counts conflict between sources." },
  ] as const,

  costs: {
    councilTax: { band: "C", yearly: 1902.26, url: "https://www.bromley.gov.uk/council-tax/council-tax-guide",
      note: "Bromley’s 2026/27 charge before discounts. Confirm the band for this address." },
    energy: { monthly: 143.82, url: "https://octopus.energy/quote/?postcode=BR5%202HH",
      note: "Octopus Flexible, electricity and gas, based on medium use (2,500 kWh electricity and 9,500 kWh gas a year). Includes the upcoming October rates." },
    broadband: { headline: "Up to 5,000 Mbps", url: "https://checker.ofcom.org.uk/en-gb/broadband-coverage#pc=BR52HH&uprn=100020446716",
      note: "Ofcom predicts ultrafast full fibre (5,000 Mbps down and up) at this address. Standard broadband: 27 / 6 Mbps. These are network predictions, not a package." },
    market: { url: "https://www.ons.gov.uk/visualisations/housingpriceslocal/E09000006/",
      note: "Bromley-wide trends are useful background, but local two-bedroom sales matter more for this home." },
  },

  evidence: [
    { title: "Ofcom broadband check", src: "/valuation/ofcom-evidence.jpg", url: "https://checker.ofcom.org.uk/en-gb/broadband-coverage#pc=BR52HH&uprn=100020446716",
      alt: "Ofcom checker for 10 Amherst Close showing predicted ultrafast speeds of 5,000 Mbps down and up" },
    { title: "Octopus Flexible quote", src: "/valuation/octopus-evidence.jpg", url: "https://octopus.energy/quote/?postcode=BR5%202HH",
      alt: "Octopus Flexible quote showing a £143.82 monthly estimate with electricity and gas unit rates" },
  ],

  sources: [
    { label: "Zoopla property details", url: "https://www.zoopla.co.uk/house-prices/orpington/amherst-close/" },
    { label: "Bricks & Logic property record", url: "https://www.bricksandlogic.co.uk/place/street/amherst-close-orpington-br5" },
    { label: "Rightmove sold prices", url: "https://www.rightmove.co.uk/house-prices/br5/amherst-drive.html" },
    { label: "Ofcom · 10 Amherst Close", url: "https://checker.ofcom.org.uk/en-gb/broadband-coverage#pc=BR52HH&uprn=100020446716" },
    { label: "Octopus · quote for BR5 2HH", url: "https://octopus.energy/quote/?postcode=BR5%202HH" },
    { label: "Bromley council tax", url: "https://www.bromley.gov.uk/council-tax/council-tax-guide" },
  ],
};

export type Comparable = (typeof valuation.comparables)[number];
