# Simple/Advanced Mode — Phase 1 Foundation Design

**Date:** 2026-04-18
**Project:** boros-tools (boros.lekker.design)
**Status:** Approved — Phase 1 of a 3-phase redesign

---

## Background

The site currently has 14 pages under a flat navigation: 6 top-level items plus a "Pendle Tools" dropdown containing 9 more. A new visitor sees 15 navigation targets and has no guidance on where to start. Retail users and family-office decision-makers don't need (and can't absorb) tools like the Arbitrage Scanner, Whale Tracker, or P&L Simulator. Power traders, meanwhile, want fast access to everything with no hand-holding.

The fix is a **Simple/Advanced mode toggle** that reorganizes the navigation and — in later phases — adapts page content to match the user's chosen experience level.

This spec covers **Phase 1 only**: the foundational state machine, navigation restructure, and toggle UI. Phases 2 and 3 (Home page redesign, page-level polish) are separate specs.

---

## Goals (Phase 1)

1. Add a persistent Simple/Advanced mode with localStorage persistence
2. Restructure navigation so Simple mode shows 4 flat items and Advanced mode shows 5 grouped dropdowns
3. Build a visible toggle in the navbar (desktop + mobile) so users can switch modes anytime
4. Provide a `useMode()` hook so any page can opt into mode-aware behavior in later phases

## Non-Goals (Phase 1)

- No page content changes. Existing pages keep rendering exactly as they do today.
- No Home page redesign (that's Phase 2).
- No column hiding in tables, no simplified language, no onboarding wizard (all Phase 2 / 3).
- No backend changes. Phase 1 is 100% client-side.

---

## Architecture

### State management

A single `ModeContext` at the app root. State shape:

```typescript
type Mode = "simple" | "advanced";
interface ModeContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
}
```

### Persistence

- localStorage key: `useboros-mode`
- Read on initial mount via lazy useState initializer
- Write on every change via useEffect
- Default for first-time visitors: `"simple"`
- If localStorage is unavailable (SSR-safe), gracefully default to `"simple"`

### Provider placement

`ModeProvider` wraps the entire app inside `App.tsx`, above the router. This guarantees every page and every component has access to `useMode()`.

---

## Navigation Restructure

### Current state

`client/src/lib/constants.ts` exports two flat arrays:
- `NAV_LINKS` — 6 items (Terminal, Arbitrage, Simulator, Heatmap, Yields, Strategies)
- `PENDLE_TOOLS_LINKS` — 9 items (Calculator, Calendar, History, Rewards, Portfolio, Compare, Screener, Whales, sPENDLE)

Total: 15 items rendered in the top nav, 9 of them hidden behind a single dropdown. This will be replaced by a single unified structure.

### New structure

Add a new export `NAV_STRUCTURE` to `constants.ts`:

```typescript
export const NAV_STRUCTURE = {
  simple: [
    { label: "Home", href: "/" },
    { label: "Portfolio", href: "/portfolio" },
    { label: "Yields", href: "/yields" },
    { label: "Strategies", href: "/strategies" },
  ] as const,
  advanced: [
    { label: "Home", href: "/" },
    { label: "Discover", items: [
      { label: "Yields", href: "/yields" },
      { label: "APY Screener", href: "/screener" },
      { label: "Maturity Calendar", href: "/calendar" },
      { label: "Rewards", href: "/rewards" },
      { label: "Rate Compare", href: "/compare" },
    ] },
    { label: "Monitor", items: [
      { label: "Terminal", href: "/terminal" },
      { label: "Heatmap", href: "/heatmap" },
      { label: "Yield History", href: "/history" },
      { label: "Whale Tracker", href: "/whales" },
    ] },
    { label: "Portfolio", items: [
      { label: "Strategy Engine", href: "/portfolio" },
      { label: "Calculator", href: "/calculator" },
      { label: "P&L Simulator", href: "/simulator" },
    ] },
    { label: "Trade", items: [
      { label: "Strategies", href: "/strategies" },
      { label: "Arbitrage", href: "/arbitrage" },
    ] },
    { label: "Pendle", items: [
      { label: "sPENDLE", href: "/spendle" },
    ] },
  ] as const,
};
```

### Backwards compatibility

The old `NAV_LINKS` and `PENDLE_TOOLS_LINKS` exports stay in the file but become unused. Mark them with a `@deprecated` comment. They can be removed in a later cleanup commit once no consumers remain. Footer link lists will be migrated to `NAV_STRUCTURE.advanced` in the Layout update.

### Rendering logic

`Layout.tsx` reads the current mode via `useMode()`, then picks `NAV_STRUCTURE[mode]` and renders:

- **Simple mode:** flat `<Link>` list, no dropdowns
- **Advanced mode:** top-level items with `items` arrays render as hover dropdowns, items without `items` render as plain links

The rendering function must type-narrow by checking `"items" in item`.

---

## Mode Toggle Component

### File

`client/src/components/ModeToggle.tsx` — a new standalone component. Lives at its own path so it can be imported into both desktop and mobile nav sections of Layout.

### Desktop appearance

Pill-shaped segmented control placed in the navbar immediately before the "Trade on Boros" button.

- Container: `inline-flex items-center gap-0.5 bg-background border border-card-border rounded-full p-0.5`
- Each segment: `px-3 py-1 text-[11px] font-medium rounded-full transition-colors`
- Active segment: `bg-primary text-[#090D18]` (PT Green bg, Water 900 text — guaranteed contrast)
- Inactive segment: `text-muted-foreground hover:text-foreground`

### Mobile appearance

Full-width version at the top of the mobile drawer, above the nav groups.

- Container: `flex w-full bg-background border border-card-border rounded-lg p-0.5 mb-4`
- Each segment: `flex-1 px-3 py-2 text-sm font-medium rounded-md text-center transition-colors`
- Same active/inactive colors as desktop

### Behavior

- Clicking either label sets mode immediately — no confirmation
- No page reload, no route change
- Nav re-renders within one React cycle
- Focus remains on the clicked button for keyboard users

### Accessibility

- Role: `group` on container
- Each button: `aria-pressed={mode === "simple"}` / `aria-pressed={mode === "advanced"}`
- Keyboard: Enter / Space triggers click

---

## Layout Changes

`client/src/components/Layout.tsx` is the hub for all navigation rendering. Required changes:

1. **Imports:** Add `useMode` from `@/lib/mode-context`, `ModeToggle` from `@/components/ModeToggle`, `NAV_STRUCTURE` from `@/lib/constants`.
2. **Desktop navbar:** Replace the existing `NAV_LINKS.map(...)` and Pendle Tools dropdown block with a single mode-aware renderer that reads `NAV_STRUCTURE[mode]` and dispatches on item shape.
3. **Mode toggle placement:** Insert `<ModeToggle />` immediately before the "Trade on Boros" CTA button.
4. **Mobile menu:** Replace the flat list + Pendle Tools section with a mode-aware list. Groups in advanced mode render as accordion items (tap to expand). In simple mode, render as plain flat links.
5. **Footer Tools column:** Also render from `NAV_STRUCTURE.advanced` flattened — footer always shows all tools regardless of mode, because the footer is a sitemap.

### Dropdown implementation

Reuse the existing hover-dropdown pattern already used by the current "Pendle Tools" dropdown in Layout.tsx:

```tsx
<div className="relative group">
  <button className="...">
    {group.label} <ChevronDown className="w-3 h-3" />
  </button>
  <div className="absolute top-full right-0 ... opacity-0 invisible group-hover:opacity-100 group-hover:visible ...">
    {group.items.map(item => <Link href={item.href}>...</Link>)}
  </div>
</div>
```

Keep the existing class names and transitions for visual consistency.

---

## App Provider Wiring

`client/src/App.tsx` changes:

1. Import `ModeProvider` from `@/lib/mode-context`
2. Wrap the existing app tree inside `<ModeProvider>` at the outermost level (outside QueryClientProvider is fine; either order works since they're independent)

No other changes to App.tsx.

---

## File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| `client/src/lib/mode-context.tsx` | CREATE | Context, Provider, `useMode()` hook, localStorage logic |
| `client/src/lib/constants.ts` | UPDATE | Add `NAV_STRUCTURE`; keep old exports for backwards compatibility |
| `client/src/components/ModeToggle.tsx` | CREATE | Pill toggle component (desktop + mobile variants via prop) |
| `client/src/components/Layout.tsx` | UPDATE | Consume mode, render new nav, wire in ModeToggle, mode-aware mobile menu |
| `client/src/App.tsx` | UPDATE | Wrap tree in `<ModeProvider>` |

No server changes. No new npm dependencies. No data model changes.

---

## Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| localStorage disabled (private browsing) | Default to "simple" in memory; writes silently no-op |
| localStorage contains invalid value (e.g. "foobar") | Fall back to "simple" on read |
| User has Advanced saved, route /terminal bookmarked | Still works — routes aren't mode-gated, only the nav is |
| User switches mode while on a Simple-mode-hidden page | Page still renders; nav just shows the other nav set |
| Hover dropdown on touch device | Same behavior as existing Pendle Tools dropdown (tap to open via group-hover — acceptable for Phase 1) |
| SSR (if ever enabled) | Lazy initializer guards against `window`/`localStorage` being undefined |

---

## Testing Checklist

### Manual verification
- [ ] Clear localStorage → reload site → nav shows 4 items (Simple default)
- [ ] Click "Advanced" toggle → nav re-renders with 5 dropdowns
- [ ] Reload page → Advanced mode persists
- [ ] Switch back to Simple → nav collapses to 4 items → reload → still Simple
- [ ] Hover each Advanced dropdown on desktop → correct items appear
- [ ] Open mobile drawer (< 768px) → toggle visible at top, nav groups collapse/expand correctly
- [ ] All existing routes still reachable from both modes (via direct URL if needed)
- [ ] Footer still shows complete sitemap regardless of mode
- [ ] "Trade on Boros" CTA still visible in both modes
- [ ] `useMode()` hook can be called from any page without error

### Typescript / build
- [ ] `npm run check` passes with zero errors
- [ ] `npm run build` completes successfully
- [ ] No console warnings about hooks or context on page load

---

## Rollback

If anything breaks after deployment:

```bash
git revert <commit-hash>
npm run build
pm2 restart boros-tools
```

Since Phase 1 is purely additive (new files + Layout refactor), a single revert cleanly returns to the current working state. No data migration needed.

---

## What Comes Next (Context Only — Not In This Phase)

**Phase 2** will redesign the Home page into a live command center that reads mode-aware templates (Simple = "What should I do today?" cards, Advanced = streaming terminal view). It will also add beginner/pro onboarding flows.

**Phase 3** will add page-level polish: sparklines in tables, mode-aware column visibility, smoother transitions, better empty states. Each existing page will progressively adopt `useMode()` to tune its content.

Phase 1 provides the hook and navigation primitives those phases depend on. Ship Phase 1 first.
