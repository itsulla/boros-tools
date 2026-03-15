export const BOROS_REFERRAL_URL = "https://boros.pendle.finance?ref=PLACEHOLDER";

export const BOROS_API_BASE = "https://api.boros.finance/core";

export const NAV_LINKS = [
  { label: "Terminal", href: "/terminal" },
  { label: "Arbitrage", href: "/arbitrage" },
  { label: "Simulator", href: "/simulator" },
  { label: "Heatmap", href: "/heatmap" },
  { label: "Yields", href: "/yields" },
  { label: "Strategies", href: "/strategies" },
] as const;

export const EXTERNAL_LINKS = {
  pendle: "https://www.pendle.finance",
  boros: "https://boros.pendle.finance",
  docs: "https://docs.pendle.finance",
  github: "https://github.com/pendle-finance",
} as const;
