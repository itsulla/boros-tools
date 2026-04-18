import type { ReactNode } from "react";
import { Link } from "wouter";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
  className?: string;
}

export function EmptyState({ icon, title, description, cta, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className ?? ""}`}>
      <div className="w-12 h-12 rounded-full bg-card border border-card-border flex items-center justify-center text-muted-foreground mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>
      )}
      {cta && (
        <Link href={cta.href}>
          <span className="inline-flex items-center mt-4 px-4 py-1.5 text-xs font-medium border border-primary/40 text-primary rounded-lg hover:bg-primary/10 cursor-pointer transition-colors">
            {cta.label}
          </span>
        </Link>
      )}
    </div>
  );
}
