import { OpportunityCard } from "./OpportunityCard";

const STRATEGIES = [
  { id: "cash-carry", title: "Cash & Carry Arbitrage", desc: "Long spot + short perp + fix on Boros", est: "5-15% APR" },
  { id: "hedge", title: "Funding Rate Hedging", desc: "Convert floating to fixed on Boros", est: "Eliminates funding risk" },
  { id: "long-spec", title: "Rate Speculation (Long)", desc: "Bet rates will go up", est: "Unlimited upside" },
  { id: "short-spec", title: "Rate Speculation (Short)", desc: "Bet rates will decline", est: "Profits on cooldown" },
];

export function FeaturedStrategyCard({ variant }: { variant: "compact" | "dense" }) {
  const day = Math.floor(Date.now() / 86400000);
  const s = STRATEGIES[day % STRATEGIES.length];
  return (
    <OpportunityCard icon="💡" title="Featured Strategy" variant={variant} cta={{ label: "Try this strategy", href: "/strategies" }}>
      <p className="text-sm font-bold text-foreground mb-1">{s.title}</p>
      <p className="text-xs text-muted-foreground mb-2">{s.desc}</p>
      {variant === "dense" && <p className="text-[11px] text-primary font-medium">Est: {s.est}</p>}
    </OpportunityCard>
  );
}
