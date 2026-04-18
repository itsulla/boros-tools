# Simple/Advanced Mode Foundation — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Simple/Advanced mode toggle with localStorage persistence and restructure navigation into mode-specific layouts.

**Architecture:** React Context for mode state, localStorage for persistence, `NAV_STRUCTURE` const with per-mode configuration, `<ModeToggle>` component in navbar + mobile drawer.

**Tech Stack:** React 18, TypeScript, Tailwind, wouter (hash router)

**Spec reference:** `docs/superpowers/specs/2026-04-18-simple-advanced-mode-foundation-design.md`

---

## Task 1: Create ModeContext provider

**Files:**
- Create: `client/src/lib/mode-context.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Mode = "simple" | "advanced";

interface ModeContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const STORAGE_KEY = "useboros-mode";

function readStoredMode(): Mode {
  if (typeof window === "undefined") return "simple";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "advanced" ? "advanced" : "simple";
  } catch {
    return "simple";
  }
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(readStoredMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage disabled — silently no-op
    }
  }, [mode]);

  const setMode = (m: Mode) => setModeState(m);
  const toggleMode = () => setModeState((prev) => (prev === "simple" ? "advanced" : "simple"));

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used inside ModeProvider");
  return ctx;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/muffinman/boros-tools
npm run check
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/mode-context.tsx
git commit -m "feat: add ModeContext provider with localStorage persistence"
```

---

## Task 2: Add NAV_STRUCTURE to constants

**Files:**
- Modify: `client/src/lib/constants.ts`

- [ ] **Step 1: Add the NAV_STRUCTURE export**

Open `client/src/lib/constants.ts`. After the existing `NAV_LINKS` and `PENDLE_TOOLS_LINKS` exports, add:

```typescript
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
```

Keep `NAV_LINKS` and `PENDLE_TOOLS_LINKS` in place (don't delete) — they'll be removed after Layout migration.

- [ ] **Step 2: Typecheck**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/constants.ts
git commit -m "feat: add NAV_STRUCTURE for mode-aware navigation"
```

---

## Task 3: Build ModeToggle component

**Files:**
- Create: `client/src/components/ModeToggle.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useMode, type Mode } from "@/lib/mode-context";

interface Props {
  variant?: "desktop" | "mobile";
}

export function ModeToggle({ variant = "desktop" }: Props) {
  const { mode, setMode } = useMode();

  if (variant === "mobile") {
    return (
      <div
        role="group"
        aria-label="Interface complexity"
        className="flex w-full bg-background border border-card-border rounded-lg p-0.5 mb-4"
      >
        {(["simple", "advanced"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md text-center transition-colors capitalize ${
              mode === m
                ? "bg-primary text-[#090D18]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Interface complexity"
      className="inline-flex items-center gap-0.5 bg-background border border-card-border rounded-full p-0.5"
    >
      {(["simple", "advanced"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={`px-3 py-1 text-[11px] font-medium rounded-full transition-colors capitalize ${
            mode === m
              ? "bg-primary text-[#090D18]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ModeToggle.tsx
git commit -m "feat: add ModeToggle segmented control component"
```

---

## Task 4: Update Layout.tsx to render mode-aware nav

**Files:**
- Modify: `client/src/components/Layout.tsx`

**Context:** The current Layout.tsx has:
- Desktop nav: `NAV_LINKS.map(...)` followed by a "Pendle Tools" dropdown block
- Mobile drawer: flat `NAV_LINKS.map(...)` + a "Pendle Tools" section
- Footer Tools column: `NAV_LINKS.map(...)` + `PENDLE_TOOLS_LINKS.map(...)` in the same `<div>`

Replace all three with mode-aware rendering. Reuse existing class names for visual consistency.

- [ ] **Step 1: Update imports at the top of Layout.tsx**

Replace the line:
```typescript
import { NAV_LINKS, PENDLE_TOOLS_LINKS, BOROS_REFERRAL_URL, EXTERNAL_LINKS } from "@/lib/constants";
```

With:
```typescript
import { NAV_STRUCTURE, flattenNavLeaves, BOROS_REFERRAL_URL, EXTERNAL_LINKS, type NavEntry } from "@/lib/constants";
import { useMode } from "@/lib/mode-context";
import { ModeToggle } from "@/components/ModeToggle";
```

Keep the existing `Menu, X, ExternalLink, ChevronDown` import from lucide-react. Add `useState` import for the mobile accordion state if not already present.

- [ ] **Step 2: Consume mode inside the `Navbar` component**

At the top of the Navbar function body, add:
```typescript
  const { mode } = useMode();
  const navEntries = NAV_STRUCTURE[mode] as readonly NavEntry[];
```

- [ ] **Step 3: Replace the desktop nav block**

Find the desktop nav section — it's the `<div className="hidden md:flex items-center gap-1">` block containing `NAV_LINKS.map(...)` and the Pendle Tools dropdown.

Replace the entire contents of that `<div>` with:

```tsx
            {navEntries.map((entry) => {
              if ("href" in entry) {
                const isActive = location === entry.href;
                return (
                  <Link key={entry.href} href={entry.href}>
                    <span
                      className={`px-3 py-1.5 text-[13px] font-medium cursor-pointer transition-colors ${
                        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {entry.label}
                    </span>
                  </Link>
                );
              }
              // Group dropdown
              return (
                <div key={entry.label} className="relative group">
                  <button className="flex items-center gap-0.5 px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                    {entry.label}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="absolute top-full right-0 mt-1 w-44 bg-card border border-card-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                    <div className="py-1">
                      {entry.items.map((item) => {
                        const isActive = location === item.href;
                        return (
                          <Link key={item.href} href={item.href}>
                            <span
                              className={`block px-4 py-2 text-[13px] cursor-pointer transition-colors ${
                                isActive
                                  ? "text-primary bg-primary/5"
                                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                              }`}
                            >
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
```

- [ ] **Step 4: Insert ModeToggle into the desktop top-right cluster**

Find the "Trade on Boros" CTA button in the desktop navbar. Immediately before it, insert:

```tsx
          <div className="hidden md:flex items-center">
            <ModeToggle variant="desktop" />
          </div>
```

- [ ] **Step 5: Replace the mobile menu nav section**

Find the mobile drawer section — the one rendered when `mobileOpen` is true. It currently contains `NAV_LINKS.map(...)` followed by a "Pendle Tools" border-top block.

Replace with a mode-aware renderer. Above the nav list, add `<ModeToggle variant="mobile" />`. For the nav, use a simple accordion using `useState`:

```tsx
          {/* Mode toggle at top of mobile drawer */}
          <ModeToggle variant="mobile" />

          {navEntries.map((entry) => {
            if ("href" in entry) {
              const isActive = location === entry.href;
              return (
                <Link key={entry.href} href={entry.href}>
                  <span
                    onClick={() => setMobileOpen(false)}
                    className={`block px-3 py-2 text-sm cursor-pointer ${
                      isActive
                        ? "text-primary border-l-2 border-primary pl-2.5"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {entry.label}
                  </span>
                </Link>
              );
            }
            const isExpanded = expandedGroups.has(entry.label);
            return (
              <div key={entry.label}>
                <button
                  onClick={() =>
                    setExpandedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(entry.label)) next.delete(entry.label);
                      else next.add(entry.label);
                      return next;
                    })
                  }
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <span className="font-medium">{entry.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && (
                  <div className="pl-4">
                    {entry.items.map((item) => {
                      const isActive = location === item.href;
                      return (
                        <Link key={item.href} href={item.href}>
                          <span
                            onClick={() => setMobileOpen(false)}
                            className={`block px-3 py-2 text-sm cursor-pointer ${
                              isActive
                                ? "text-primary border-l-2 border-primary pl-2.5"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
```

Add the necessary state at the top of Navbar (alongside `mobileOpen`):
```typescript
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
```

- [ ] **Step 6: Replace the Footer Tools column**

Find the Footer component. The "Tools" column currently renders `NAV_LINKS.map(...)` followed by `PENDLE_TOOLS_LINKS.map(...)`.

Replace with a single render from `flattenNavLeaves()`:

```tsx
              {flattenNavLeaves().map((link) => (
                <Link key={link.href} href={link.href}>
                  <span className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    {link.label}
                  </span>
                </Link>
              ))}
```

- [ ] **Step 7: Typecheck**

```bash
npm run check
```

- [ ] **Step 8: Commit**

```bash
git add client/src/components/Layout.tsx
git commit -m "feat: render mode-aware navigation in Layout with accordion mobile drawer"
```

---

## Task 5: Wrap App in ModeProvider

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add import**

At the top of App.tsx, add:
```typescript
import { ModeProvider } from "@/lib/mode-context";
```

- [ ] **Step 2: Wrap the root**

Find the root of the App component return (e.g. `<QueryClientProvider ...>` or similar). Wrap the entire tree in `<ModeProvider>`:

```tsx
return (
  <ModeProvider>
    <QueryClientProvider client={queryClient}>
      {/* ...existing tree... */}
    </QueryClientProvider>
  </ModeProvider>
);
```

If the existing return has multiple top-level children (rare), wrap the outermost provider.

- [ ] **Step 3: Typecheck**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: wrap app tree in ModeProvider"
```

---

## Task 6: Build, deploy, verify

- [ ] **Step 1: Build**

```bash
cd /home/muffinman/boros-tools
npm run build 2>&1 | tail -5
```
Expected: `dist/public` + `dist/index.cjs` generated, no errors.

- [ ] **Step 2: Restart PM2**

```bash
pm2 restart boros-tools
```

- [ ] **Step 3: Smoke test via curl**

```bash
curl -s -o /dev/null -w "%{http_code}" https://boros.lekker.design
```
Expected: `200`

- [ ] **Step 4: Manual browser verification**

Open https://boros.lekker.design:
- [ ] Default mode is Simple (clear localStorage first if needed: `localStorage.clear()` in console)
- [ ] Nav shows: Home, Portfolio, Yields, Strategies (4 items)
- [ ] Click Advanced in the toggle → nav shows 5 dropdown groups
- [ ] Hover Discover → shows Yields, Screener, Calendar, Rewards, Rate Compare
- [ ] Hover Monitor → shows Terminal, Heatmap, Yield History, Whale Tracker
- [ ] Reload page → stays in Advanced
- [ ] Click Simple → reverts cleanly
- [ ] On mobile width (< 768px) → hamburger opens drawer with toggle at top
- [ ] Expand a group in mobile drawer → items slide out; tapping one closes drawer and navigates
- [ ] Footer still shows every page regardless of mode

- [ ] **Step 5: Save PM2 & push**

```bash
pm2 save
git push fork main
```

---

## Rollback

If any step fails after deploy:
```bash
git log --oneline -10  # find the last-good commit before Phase 1
git revert <commit-hash>...HEAD
npm run build && pm2 restart boros-tools
```

All changes are additive; reverting restores the pre-Phase-1 state cleanly.
