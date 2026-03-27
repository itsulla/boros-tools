# Portfolio Strategy Engine

## Overview

A portfolio calculator at `/#/portfolio` that lets users input an investment amount and get an optimized allocation across Pendle V2 PT markets with projected returns. Two modes: Auto (one-click allocation) and Advanced (manual market picking).

## Data Source

Uses existing `/api/pendle/markets-raw` endpoint — no new server endpoints needed. All calculation is client-side.

## Auto Mode (default)

### Inputs
- **Investment amount** — number input with `$` prefix, default $10,000
- **Asset class filter** — toggle buttons: "Stablecoins", "ETH", "BTC", "All"
- **Minimum TVL filter** — slider or input, default $1M, range $100k–$50M

### Asset class classification (derived from market `asset` field)
- **Stablecoins:** USDC, USDT, USDe, sUSDe, USDG, USD0, crvUSD, GHO, DAI, FRAX, and any asset containing "USD" or "stable"
- **ETH:** wstETH, weETH, eETH, stETH, rETH, cbETH, mETH, swETH, and any asset containing "ETH"
- **BTC:** WBTC, tBTC, cbBTC, sBTC, and any asset containing "BTC"
- **All:** no filter

### Scoring formula
```
score = (impliedApy × 0.6) + (normalizedTvl × 0.3) + (maturityFactor × 0.1)
```

Where:
- `impliedApy` is the raw decimal (e.g., 0.054)
- `normalizedTvl = log10(totalTvl) / log10(maxTvl)` — normalized 0–1 against the largest pool
- `maturityFactor = Math.min(daysToMaturity, 365) / 365` — longer maturity scores higher (more yield duration)

### Allocation logic
1. Filter markets by asset class and minimum TVL
2. Remove expired markets (`daysToMaturity <= 0`)
3. Score and sort descending
4. Allocate greedily: assign up to 40% of capital to the top market, then up to 40% to second, etc., until capital is fully allocated
5. Minimum 3 markets if enough qualify; if fewer than 3 markets pass filters, allocate evenly across what's available

### Output
- **Blended APY** — weighted average: `sum(position.apy × position.weight) / totalInvested`
- **Projected annual return** — `investment × blendedApy`
- **Projected monthly return** — `annualReturn / 12`
- **Allocation table** — each row shows: market name, chain, asset, allocation ($), allocation (%), implied APY, projected return, days to maturity, badges

## Advanced Mode

### Inputs
- Same investment amount and TVL filter
- Filterable/searchable market list (all markets from `/api/pendle/markets-raw`)
- User clicks markets to add them, assigns dollar amount or percentage per position
- Total must equal investment amount — show remaining unallocated balance

### Output
- Same blended APY, projected returns, and allocation table as Auto mode
- Warning banner if any single position exceeds 40% of total: "High concentration: {market} is {X}% of your portfolio"

## Risk Badges & Disclaimers

### Per-market badges (shown in allocation table)
- **Low Liquidity** (yellow) — TVL < $1M
- **Near Expiry** (red) — daysToMaturity < 14
- **Points** (teal) — categoryIds contains "points" (upside indicator, not risk)
- **New** (blue) — `isNew` is true

### Risk disclaimer (always visible below results)
Card with `border-destructive/30` styling:
> "This is a projection tool, not financial advice. PT yields are fixed only if held to maturity — early exit may result in losses. Returns depend on protocol risk, smart contract risk, and market conditions. Smaller pools carry higher liquidity risk. Always DYOR."

## UI Layout

### Page structure
1. Title: "Portfolio Strategy Engine" / subtitle: "Model your Pendle yield portfolio"
2. Mode toggle: "Auto" / "Advanced" pill buttons
3. Input section (card)
4. Results section (card, shown after calculation):
   - Summary stats: Blended APY, Annual Return, Monthly Return (3-column grid)
   - Allocation table
   - Risk badges inline per row
5. Risk disclaimer card
6. `<StickyCTA text="Build your portfolio on Pendle" />`

### Allocation table columns
- Market Name (with badges)
- Chain
- Asset
- Allocation ($)
- Weight (%)
- Implied APY
- Projected Return
- Days to Maturity

## Navigation

Add "Portfolio" to the existing `PENDLE_TOOLS_LINKS` in `constants.ts`.

## File changes

| File | Change |
|------|--------|
| `client/src/pages/Portfolio.tsx` | New — full page implementation |
| `client/src/lib/constants.ts` | Add Portfolio to PENDLE_TOOLS_LINKS |
| `client/src/App.tsx` | Add route + import |
