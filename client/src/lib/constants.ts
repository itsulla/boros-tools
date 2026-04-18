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

export const PENDLE_TOOLS_LINKS = [
  { label: "Calculator", href: "/calculator" },
  { label: "Calendar", href: "/calendar" },
  { label: "History", href: "/history" },
  { label: "Rewards", href: "/rewards" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Compare", href: "/compare" },
  { label: "Screener", href: "/screener" },
  { label: "Whales", href: "/whales" },
  { label: "sPENDLE", href: "/spendle" },
] as const;

/**
 * Mode-aware navigation structure.
 * Consumed by Layout.tsx depending on the current Simple/Advanced mode.
 *
 * Top-level item shape:
 *   - { label, href }                       -> plain link
 *   - { label, items: [{ label, href }] }   -> dropdown group
 */
export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; items: readonly NavItem[] };
export type NavEntry = NavItem | NavGroup;

export const NAV_STRUCTURE: {
  simple: readonly NavItem[];
  advanced: readonly NavEntry[];
} = {
  simple: [
    { label: "Home", href: "/" },
    { label: "Portfolio", href: "/portfolio" },
    { label: "Yields", href: "/yields" },
    { label: "Strategies", href: "/strategies" },
  ],
  advanced: [
    { label: "Home", href: "/" },
    {
      label: "Discover",
      items: [
        { label: "Yields", href: "/yields" },
        { label: "APY Screener", href: "/screener" },
        { label: "Maturity Calendar", href: "/calendar" },
        { label: "Rewards", href: "/rewards" },
        { label: "Rate Compare", href: "/compare" },
      ],
    },
    {
      label: "Monitor",
      items: [
        { label: "Terminal", href: "/terminal" },
        { label: "Heatmap", href: "/heatmap" },
        { label: "Yield History", href: "/history" },
        { label: "Whale Tracker", href: "/whales" },
      ],
    },
    {
      label: "Portfolio",
      items: [
        { label: "Strategy Engine", href: "/portfolio" },
        { label: "Calculator", href: "/calculator" },
        { label: "P&L Simulator", href: "/simulator" },
      ],
    },
    {
      label: "Trade",
      items: [
        { label: "Strategies", href: "/strategies" },
        { label: "Arbitrage", href: "/arbitrage" },
      ],
    },
    {
      label: "Pendle",
      items: [
        { label: "sPENDLE", href: "/spendle" },
      ],
    },
  ],
};

/** Helper: flatten advanced nav into leaves (for footer sitemap). */
export function flattenNavLeaves(): readonly NavItem[] {
  const out: NavItem[] = [];
  for (const entry of NAV_STRUCTURE.advanced) {
    if ("href" in entry) out.push(entry);
    else for (const item of entry.items) out.push(item);
  }
  return out;
}

export const EXTERNAL_LINKS = {
  pendle: "https://www.pendle.finance",
  boros: "https://boros.pendle.finance",
  docs: "https://docs.pendle.finance",
  github: "https://github.com/pendle-finance",
} as const;
