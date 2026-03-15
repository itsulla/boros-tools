import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, ExternalLink } from "lucide-react";
import { NAV_LINKS, BOROS_REFERRAL_URL, EXTERNAL_LINKS } from "@/lib/constants";

function BorosLogo() {
  return (
    <Link href="/" data-testid="link-home">
      <div className="flex items-center gap-1.5 cursor-pointer">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="Boros Tools logo">
          <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#logo-grad)" strokeWidth="2.5" fill="none" />
          <path d="M10 11h6a4 4 0 010 8h-6" stroke="#1BE3C2" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M10 11v10" stroke="#6079FF" strokeWidth="2" strokeLinecap="round" />
          <circle cx="22" cy="16" r="2.5" fill="url(#logo-grad)" />
          <defs>
            <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
              <stop stopColor="#1BE3C2" />
              <stop offset="1" stopColor="#6079FF" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight">
            <span className="gradient-text">Boros</span>{" "}
            <span className="text-white">Tools</span>
          </span>
          <span className="text-[10px] text-muted-foreground">by Pendle</span>
        </div>
      </div>
    </Link>
  );
}

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl"
      style={{ backgroundColor: "rgba(9, 13, 24, 0.85)" }}
      data-testid="navbar"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <BorosLogo />

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <span
                    className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors cursor-pointer ${
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                    data-testid={`nav-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <a
              href={BOROS_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 gradient-bg text-background text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              data-testid="cta-trade"
            >
              Trade on Boros
              <ExternalLink className="w-3 h-3" />
            </a>

            {/* Mobile toggle */}
            <button
              className="md:hidden p-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) => {
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <span
                    onClick={() => setMobileOpen(false)}
                    className={`block px-3 py-2 text-sm rounded-md cursor-pointer ${
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
            <a
              href={BOROS_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-center gradient-bg text-background text-sm font-semibold px-4 py-2.5 rounded-lg"
            >
              Trade on Boros
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/50 mt-auto" data-testid="footer">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tools</h4>
            <div className="space-y-2">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">External</h4>
            <div className="space-y-2">
              <a href={EXTERNAL_LINKS.pendle} target="_blank" rel="noopener noreferrer" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Pendle Finance</a>
              <a href={EXTERNAL_LINKS.boros} target="_blank" rel="noopener noreferrer" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Boros App</a>
              <a href={EXTERNAL_LINKS.docs} target="_blank" rel="noopener noreferrer" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</a>
              <a href={EXTERNAL_LINKS.github} target="_blank" rel="noopener noreferrer" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground/70 max-w-xl text-center sm:text-left">
            This site is not affiliated with Pendle Finance. Data is provided as-is for informational purposes only. Not financial advice.
          </p>
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            Created with Perplexity Computer
          </a>
        </div>
      </div>
    </footer>
  );
}

export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Sticky CTA bar for tool pages
export function StickyCTA({ text }: { text?: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 backdrop-blur-xl" style={{ backgroundColor: "rgba(9, 13, 24, 0.9)" }}>
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground hidden sm:block">
          {text || "Ready to trade? Lock in rates on Boros"}
        </p>
        <a
          href={BOROS_REFERRAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 gradient-bg text-background text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity ml-auto"
          data-testid="cta-sticky"
        >
          Trade on Boros →
        </a>
      </div>
    </div>
  );
}
