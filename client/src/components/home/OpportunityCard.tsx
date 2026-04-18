import type { ReactNode } from "react";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";

export interface OpportunityCardProps {
  icon: ReactNode;
  title: string;
  variant: "compact" | "dense";
  isLoading?: boolean;
  children: ReactNode;
  cta?: { label: string; href: string };
}

export function OpportunityCard({ icon, title, variant, isLoading, children, cta }: OpportunityCardProps) {
  const pad = variant === "dense" ? "p-4" : "p-5";
  return (
    <div className={`bg-card border border-card-border rounded-xl ${pad} flex flex-col min-h-0 hover:-translate-y-0.5 transition-transform duration-150`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg leading-none">{icon}</span>
        <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">{title}</h3>
      </div>
      <div className="flex-1">
        {isLoading ? <div className="text-xs text-muted-foreground">Loading…</div> : children}
      </div>
      {cta && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <Link href={cta.href}>
            <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
              {cta.label} <ExternalLink className="w-3 h-3" />
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
