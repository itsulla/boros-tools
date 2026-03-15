# Boros Tools — Complete Build Specification

## Project Overview
A standalone promotional dashboard suite for Pendle Finance's Boros product (on-chain funding rate trading). The site serves as a traffic magnet with useful trader tools, funneling users to Pendle/Boros via referral CTAs. Built on React + Vite + Tailwind + shadcn/ui (the webapp template already installed at `/home/user/workspace/boros-tools/`).

## Brand & Design System (from Pendle Brand Guide)

### Colors (dark-mode only — no light mode)
This is a dark-theme-only dashboard. Replace ALL `red` placeholders in `index.css` and remove the `:root` light mode block, or set `:root` identical to `.dark`.

**Primary palette (HSL values for index.css — H S% L% format, no hsl() wrapper):**
- Background: `220 47% 6%` (#090D18 — WATER-900)
- Card/surface: `216 31% 12%` (#141E2E — slightly lighter than bg)
- Card elevated: `215 27% 16%` (#1C2B3D)
- Border: `216 24% 32%` (#374B6D — WATER-700)
- Border subtle: `215 22% 22%` (#2B3B55 — WATER-800)

**Text:**
- Foreground: `0 0% 100%` (#FFFFFF)
- Muted foreground: `216 22% 75%` (#BFCBDF — WATER-200)
- Faint: `215 18% 62%` (#9DAFCD — WATER-300)

**Brand accents:**
- Primary (PT Green / Pendle teal): `168 79% 50%` (#1BE3C2)
- Primary foreground: `220 47% 6%`
- Secondary (Pendle Blue): `229 100% 68%` (#6079FF)  
- Ring: `168 79% 50%`
- Accent: `216 24% 18%`
- Accent foreground: `0 0% 100%`

**Semantic:**
- Success/green: `168 79% 50%` (same as primary — PT Green)
- Error/red: `0 61% 60%` (#DD5453)
- Warning/gold: `43 84% 63%` (#F0CE74)
- Chart colors: 
  - chart-1: `168 79% 50%` (teal)
  - chart-2: `229 100% 68%` (blue)
  - chart-3: `192 55% 66%` (azure)
  - chart-4: `43 84% 63%` (gold)
  - chart-5: `0 100% 79%` (guava/salmon)

**Gradients used in CTAs/headers:**
- Primary gradient: `linear-gradient(135deg, #1BE3C2, #6079FF)` (teal to blue)
- Subtle surface gradient: `linear-gradient(180deg, #2B3B55, #090D18)` (water-800 to water-900)

### Typography
- Font: `Inter` (Google Fonts) for everything
- Font mono: `JetBrains Mono` or system monospace for data/numbers
- All numerical data: `font-variant-numeric: tabular-nums lining-nums`

### Logo
Use the official Pendle Boros logo. In the nav header, display as text: "Boros Tools" with "Boros" in the teal gradient and "Tools" in white. Add a small "by Pendle" subtitle in muted text.

## Architecture

### Routing (hash-based, required by template)
Use `useHashLocation` from `wouter/use-hash-location`.

Pages:
- `/#/` — Home / Landing (overview + quick stats)
- `/#/terminal` — Tool 1: Funding Rate Terminal
- `/#/arbitrage` — Tool 2: Arbitrage Scanner
- `/#/simulator` — Tool 3: P&L Simulator
- `/#/heatmap` — Tool 4: Funding Rate Heatmap
- `/#/yields` — Tool 5: Yield Comparison
- `/#/strategies` — Tool 6: Strategy Explainer Hub

### Navigation
Top horizontal nav bar (not sidebar — this is a public tools site, not an admin panel):
- Sticky, dark background (#090D18 with slight transparency + backdrop-blur)
- Logo left, nav links center, "Trade on Boros" CTA button right
- Nav links: Terminal, Arbitrage, Simulator, Heatmap, Yields, Strategies
- Active link highlighted with teal underline
- Mobile: hamburger menu
- CTA button: gradient background (#1BE3C2 → #6079FF), links to `https://boros.pendle.finance?ref=PLACEHOLDER`

### Data Architecture
This is a CLIENT-SIDE ONLY app. No backend needed. All data comes from public APIs:

**Boros API (no auth needed for reads):**
- Base: `https://api.boros.finance/core`
- `GET /v1/markets?skip=0&limit=20&isWhitelisted=true` — market list
- `GET /v1/markets/{marketId}` — single market details
- `GET /v1/markets/chart?marketId={id}&timeFrame=1h&startTimestamp={start}&endTimestamp={end}` — chart data
- `GET /v1/order-books/{marketId}?tickSize=0.0001` — order book
- `GET /v1/markets/market-trades?marketId={id}&skip=0&limit=20` — recent trades
- `GET /v2/simulations/place-order?marketId={id}&side={0|1}&size={bigint}&limitTick={tick}&tif=0&slippage=0.05` — simulation
- `GET /v1/amm/summary` — AMM data

**CEX Funding Rates (public, no auth):**
- Binance: `GET https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=100` and `GET https://fapi.binance.com/fapi/v1/premiumIndex` (current rates)
- Hyperliquid: `POST https://api.hyperliquid.xyz/info` with `{"type": "metaAndAssetCtxs"}` and `{"type": "fundingHistory", "coin": "BTC", "startTime": ...}`
- Bybit: `GET https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT`

**DeFi Yields (for yield comparison):**
- DefiLlama: `GET https://yields.llama.fi/pools` — all DeFi pool yields
- Filter for Aave, Compound, Pendle pools

**CORS handling:** These APIs should generally work from browser. If any have CORS issues, use a CORS proxy like `https://corsproxy.io/?` as prefix, or create mock/fallback data. The Boros API likely allows CORS. Binance/Bybit/Hyperliquid public endpoints generally work from browser.

**IMPORTANT: If APIs are unreachable or CORS-blocked, generate realistic mock/demo data so the site still looks great and is fully functional.** Always have fallback demo data.

## Page Specifications

### Page 0: Home / Landing (route: /)
A concise landing page — NOT a long marketing page. Think "dashboard home":

**Hero Section:**
- Title: "Boros Tools" in large text with teal-blue gradient
- Subtitle: "Real-time analytics and tools for Pendle Boros funding rate trading"
- Two CTA buttons: "Explore Terminal" (outline) and "Trade on Boros" (gradient fill → referral link)

**Quick Stats Bar (KPI cards):**
- Pull from Boros API `/v1/markets`: show number of active markets
- Show current BTC and ETH implied APRs from the first two markets
- Show "Boros Volume" if available from API

**Tool Cards Grid (6 cards):**
Each card links to the corresponding tool page. Card design:
- Icon (from lucide-react)
- Tool name (bold)
- One-line description
- Subtle teal border on hover

Cards:
1. BarChart3 icon → "Funding Rate Terminal" → "Live rates, charts & order book depth"
2. ArrowLeftRight icon → "Arbitrage Scanner" → "Cross-exchange funding rate opportunities"  
3. Calculator icon → "P&L Simulator" → "Model positions before you trade"
4. Grid3x3 icon → "Funding Rate Heatmap" → "Visual overview across exchanges & assets"
5. TrendingUp icon → "Yield Comparison" → "Compare Boros vs DeFi vs CeFi yields"
6. BookOpen icon → "Strategy Hub" → "Interactive guides for every Boros strategy"

### Page 1: Funding Rate Terminal (route: /terminal)
The flagship tool. A data-dense trading terminal view.

**Layout:**
- Top: Market selector dropdown (list all Boros markets from API)
- Row 1: KPI cards — Implied APR, Mark APR, Underlying APR, Best Bid, Best Ask, Spread
- Row 2 (two-column): 
  - Left (2/3): Rate chart (Recharts AreaChart) showing implied vs underlying APR over time
  - Right (1/3): Order book depth (bids in teal, asks in red, mid-price highlighted)
- Row 3: Recent trades table (time, side, size, price)

**Chart:** 
- Use Recharts AreaChart with gradient fill
- Teal line for implied APR, blue dashed for underlying APR
- X-axis: time, Y-axis: APR %
- Timeframe toggles: 1H, 4H, 1D, 1W
- Tooltip showing exact values

**Order Book:**
- Vertical layout: asks on top (red), mid-price in center (gold), bids on bottom (teal)
- Horizontal depth bars showing volume at each price level
- Update from `/v1/order-books/{marketId}`

**CTA:** Sticky bottom bar: "Ready to trade? Lock in rates on Boros →" with gradient button

### Page 2: Arbitrage Scanner (route: /arbitrage)
Cross-exchange funding rate comparison with arbitrage opportunity detection.

**Layout:**
- Top: Asset selector tabs (BTC, ETH)  
- Main table with columns: Exchange, Symbol, Current Funding Rate (annualized), 7d Average, Boros Implied Rate, Spread vs Boros, Arb Opportunity
- Color code: green when spread > 2% (profitable arb), yellow 1-2% (marginal), gray < 1%
- "Arb Opportunity" column shows estimated annualized return from the arb

**Below table:** 
- "How Arbitrage Works" explainer card:
  - Step 1: Open long on Exchange A (where funding is low)
  - Step 2: Open short on Exchange B (where funding is high)  
  - Step 3: Lock in rate on Boros to eliminate floating risk
  - Visual: simple flow diagram using CSS/divs

**Data sources:**
- Boros: markets API for implied rates
- Binance: premiumIndex for current BTC/ETH funding
- Bybit: market tickers for funding rates  
- Hyperliquid: metaAndAssetCtxs for funding rates

### Page 3: P&L Simulator (route: /simulator)
Interactive position calculator.

**Layout — left/right split:**
Left panel (inputs):
- Market selector (from Boros markets)
- Direction: Long / Short toggle (styled tabs)
- Position size (ETH/BTC amount) — number input with slider
- Entry rate (implied APR) — pre-filled from current market rate
- Expected funding rate (what you think the actual rate will be) — slider
- Duration (days) — dropdown or slider (7, 14, 30, 60, 90 days)
- Leverage — slider (1x to 20x)

Right panel (outputs):
- KPI cards: Estimated P&L, ROI %, Break-even Rate, Margin Required, Liquidation Rate
- Chart: P&L curve across a range of possible funding rates (x-axis: funding rate, y-axis: P&L)
  - Vertical line showing current underlying rate
  - Horizontal line at break-even
  - Green area (profit) and red area (loss)
- Comparison card: "vs. Just Holding" showing what happens if you don't hedge

All calculations are client-side. The math:
- Fixed rate = entry rate (what you lock in on Boros)
- If Long: PnL = (actual_rate - fixed_rate) × notional × days/365
- If Short: PnL = (fixed_rate - actual_rate) × notional × days/365
- With leverage: PnL × leverage, but margin = notional / leverage

### Page 4: Funding Rate Heatmap (route: /heatmap)
Visual grid showing funding rates across exchanges and assets.

**Layout:**
- Grid/table: rows = assets (BTC, ETH, SOL, etc.), columns = exchanges (Binance, Bybit, Hyperliquid, Boros Implied)
- Each cell: colored from red (negative rates) through gray (near zero) to green (high positive rates)
- Cell content: the annualized rate as percentage
- Color intensity indicates magnitude
- Header row with exchange logos/names
- Sort by: highest rate, lowest rate, largest spread

**Legend:** Color bar from red (-20%) to green (+40%) with intermediate values

**Insight cards below:**
- "Highest spread" card — which asset has the biggest cross-exchange spread
- "Boros opportunity" — where Boros implied rate most differs from actual rates

### Page 5: Yield Comparison (route: /yields)  
Compare yields across Pendle V2 (PT), Boros fixed rates, and DeFi lending.

**Layout:**
- Top: Filter by asset (ETH, USDT, USDC, BTC)
- Comparison table with columns: Protocol, Product, Asset, APY/APR, Type (Fixed/Variable), Maturity, Risk Level, Source Link
- Sort by APY descending

**Data rows include:**
- Boros markets (from Boros API) — fixed rate
- DeFi lending (from DefiLlama yields API) — Aave, Compound rates for same assets
- Staking yields (ETH staking ~3-4%)

**Visual:** Bar chart comparing yields across protocols for the selected asset

**CTA card:** "Lock in the best rate on Boros" when Boros offers competitive yield

### Page 6: Strategy Explainer Hub (route: /strategies)
Interactive educational content.

**Layout:** Card grid of strategies, each expandable into a detailed view.

**Strategy Cards (4 strategies):**

1. **Cash & Carry Arbitrage**
   - Description: "Earn fixed yield by going long spot + short perp + fix funding on Boros"
   - Steps: Buy spot ETH → Short ETH perp → Short YU on Boros to lock in rate
   - Live example with current rates filled in
   - Expected return calculation

2. **Funding Rate Hedging**
   - Description: "Protect your perp position from funding rate volatility"
   - Steps: Have existing long perp → Long YU on Boros → Floating cancels out, fixed cost
   - Who it's for: Large perp traders, market makers

3. **Rate Speculation (Long)**
   - Description: "Bet that funding rates will go up"
   - Steps: Pay fixed → Receive floating → Profit if rates rise above fixed
   - Risk/reward profile

4. **Rate Speculation (Short)**
   - Description: "Bet that funding rates will decline"
   - Steps: Receive fixed → Pay floating → Profit if rates drop below fixed
   - Risk/reward profile

**Each strategy card includes:**
- Visual flow diagram (CSS-based, arrows between steps)
- "Current opportunity" section with live rates from Boros API
- "Try this strategy" CTA → Boros referral link
- Difficulty badge (Beginner / Intermediate / Advanced)
- Risk badge (Low / Medium / High)

## Global Components

### Referral CTA
Every page has a subtle but present CTA linking to `https://boros.pendle.finance?ref=PLACEHOLDER`. The URL is defined in ONE constant so the user can easily swap it later.

### Footer
- Links: Terminal | Arbitrage | Simulator | Heatmap | Yields | Strategies
- External links: Pendle Finance | Boros App | Documentation | GitHub
- "Created with Perplexity Computer" link (mandatory)
- Disclaimer: "This site is not affiliated with Pendle Finance. Data is provided as-is for informational purposes only. Not financial advice."

### Loading States
Use skeleton loaders that match the real layout shapes. Show "Loading..." or pulse animation while API data is being fetched.

### Error States
If API calls fail, show the UI with "Demo Data" badge and use realistic mock data so the site still looks useful.

## Technical Notes

### No Backend
This is a static frontend-only app. Do NOT use the backend routes or storage. Just React + direct API calls.
- Remove/ignore `server/routes.ts` logic
- All data fetching via `useQuery` from @tanstack/react-query directly to external APIs

### Build & Deploy  
- Build: `npm run build`
- Deploy: `deploy_website(project_path="/home/user/workspace/boros-tools/dist/public")`

### IMPORTANT Template Rules
- Use `useHashLocation` in Router
- Use `apiRequest` only for local backend calls — for external APIs, use regular `fetch()` in custom queryFn
- Replace ALL `red` placeholder values in `index.css`
- Never use localStorage/sessionStorage
- Add `data-testid` attributes to interactive elements
- Include `<PerplexityAttribution />` component in layout
