import { Link } from "wouter";

const TOOLS = [
  { label: "Terminal", href: "/terminal" },
  { label: "Arbitrage", href: "/arbitrage" },
  { label: "Simulator", href: "/simulator" },
  { label: "Screener", href: "/screener" },
  { label: "Heatmap", href: "/heatmap" },
  { label: "Whales", href: "/whales" },
  { label: "sPENDLE", href: "/spendle" },
];

export function QuickToolsStrip() {
  return (
    <div className="mb-8">
      <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-3">Quick Tools</h3>
      <div className="flex flex-wrap gap-2">
        {TOOLS.map(t => (
          <Link key={t.href} href={t.href}>
            <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-card-border text-foreground rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors">
              {t.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
