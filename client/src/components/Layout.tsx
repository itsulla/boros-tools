import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, ExternalLink, ChevronDown } from "lucide-react";
import { NAV_LINKS, PENDLE_TOOLS_LINKS, BOROS_REFERRAL_URL, EXTERNAL_LINKS } from "@/lib/constants";

function BorosLogo() {
  return (
    <Link href="/" data-testid="link-home">
      <div className="flex items-center gap-2 cursor-pointer">
        <img
          src="./brand/boros-by-pendle-logo.svg"
          alt="Boros by Pendle"
          className="h-9 sm:h-10 w-auto"
          style={{ minWidth: "150px" }}
        />
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
      style={{ backgroundColor: "rgba(13, 20, 32, 0.85)" }}
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
                    className={`px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer relative ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`nav-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-primary rounded-full" />
                    )}
                  </span>
                </Link>
              );
            })}
            {/* Pendle Tools dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-0.5 px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                Pendle Tools
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute top-full right-0 mt-1 w-40 bg-card border border-card-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="py-1">
                  {PENDLE_TOOLS_LINKS.map((link) => {
                    const isActive = location === link.href;
                    return (
                      <Link key={link.href} href={link.href}>
                        <span className={`block px-4 py-2 text-[13px] cursor-pointer transition-colors ${isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"}`}>
                          {link.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={BOROS_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 teal-cta text-xs px-4 py-2 rounded-lg"
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
                    className={`block px-3 py-2 text-sm cursor-pointer ${
                      isActive
                        ? "text-primary border-l-2 border-primary pl-2.5"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
            <div className="border-t border-border/30 mt-2 pt-2">
              <p className="px-3 py-1 text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Pendle Tools</p>
              {PENDLE_TOOLS_LINKS.map((link) => {
                const isActive = location === link.href;
                return (
                  <Link key={link.href} href={link.href}>
                    <span
                      onClick={() => setMobileOpen(false)}
                      className={`block px-3 py-2 text-sm cursor-pointer ${isActive ? "text-primary border-l-2 border-primary pl-2.5" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </div>
            <a
              href={BOROS_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-center teal-cta text-sm px-4 py-2.5 rounded-lg"
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
            <img
              src="./brand/boros-by-pendle-logo.svg"
              alt="Boros by Pendle"
              className="h-7 w-auto mb-4 opacity-70"
            />
            <p className="text-xs text-muted-foreground/60 leading-relaxed">
              Analytics & tools for<br />Pendle Boros trading
            </p>
          </div>
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
              {PENDLE_TOOLS_LINKS.map((link) => (
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
    <div className="flex flex-col min-h-screen relative">
      {/* Full-page Boros poster background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('./brand/boros-poster-universe.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      />
      {/* Dark overlay so content remains readable */}
      <div className="fixed inset-0 z-0 bg-background/80" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

// Sticky CTA bar for tool pages
export function StickyCTA({ text }: { text?: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 backdrop-blur-xl" style={{ backgroundColor: "rgba(13, 20, 32, 0.9)" }}>
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground hidden sm:block">
          {text || "Ready to trade? Lock in rates on Boros"}
        </p>
        <a
          href={BOROS_REFERRAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 teal-cta text-sm px-5 py-2 rounded-lg ml-auto"
          data-testid="cta-sticky"
        >
          Trade on Boros →
        </a>
      </div>
    </div>
  );
}
