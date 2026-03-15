# Boros Tools — Pendle Brand Theme Redesign Spec

## Goal
Make the site look like it belongs in the Pendle/Boros ecosystem. Match the visual identity of the actual Boros app (boros.pendle.finance) and Pendle brand guide.

## Brand Assets Available
- `/client/public/brand/boros-by-pendle-logo.svg` — Official Boros logo (white on transparent, has blue glow)
- `/client/public/brand/boros-poster-orbital-waves.png` — Hero artwork (whale/cosmic waves in navy/gold/coral)
- `/client/public/brand/background-3-pendle.png` — Clean wave background (teal/blue dotted waves on dark navy)
- `/client/public/brand/background-1-pendle.png` — Wireframe terrain background (teal grid on dark)
- All 10 backgrounds and 10 poster artworks available in `/client/public/brand/`

## Exact Pendle Brand Colors (from brand guide)

### Primary Palette
- PT Green (teal): `#1BE3C2` — primary accent, positive values
- YT Blue: `#7AB7FF` — secondary blue
- Pendle Blue: `#6079FF` — buttons, secondary accents
- Success: `#51A69A`
- Azure: `#72CDDF`
- Guava: `#FF9393` — negative/loss values
- Error: `#DD5453`
- Gold: `#F0CE74` — highlights, premium
- Warning: `#EFB54B`

### WATER Palette (dark mode surfaces) — USE THESE
- WATER-900: `#090D18` — page background (darkest)
- WATER-800: `#2B3B55` — elevated cards, secondary surfaces
- WATER-700: `#374B6D` — card backgrounds, panels
- WATER-600: `#415981` — borders, dividers
- WATER-500: `#5B749D` — muted text
- WATER-400: `#7B94BD` — secondary text
- WATER-300: `#9DAFCD` — body text on dark
- WATER-200: `#BFCBDF` — emphasis text
- WATER-100: `#DAE1EC` — headings
- WATER-50: `#EBEFF5` — primary text (near white)

### Typography
- App font: **Inter** (already used)
- Marketing/media font: **Poppins** — USE for hero headings, page titles
- Mono: **JetBrains Mono** (already used)

## Boros App Design Patterns (from boros.pendle.finance)

### Background
The actual Boros app uses a deep navy-black: approximately `#0A1018` to `#0D1420`
NOT the previous `#090D18` — it's slightly warmer/bluer

### Cards
- Background: `#1A2332` with subtle borders `#1E293B`
- Slightly translucent feel
- Rounded corners (~12px)

### Navigation
- Dark horizontal bar ~60px
- White text, teal underline for active
- Clean, minimal

### Buttons
- CTA: Blue-purple gradient (Pendle Blue to lighter blue)
- OR teal solid (#1BE3C2 bg with dark text)
- Height ~44-48px, rounded-lg

### Data Presentation
- Teal (#1BE3C2) for positive/bullish numbers
- Red (#DD5453) for negative/bearish
- Gold (#F0CE74) for highlights/neutral emphasis
- Muted gray text (#7B94BD to #9DAFCD range)

## SPECIFIC CHANGES REQUIRED

### 1. index.css — Update CSS Variables
Replace the color tokens to match EXACTLY:
```
--background: 216 47% 5%;       /* #0D1420 — Boros deep navy */
--foreground: 220 30% 95%;      /* #EBEFF5 — WATER-50 */
--border: 213 24% 17%;          /* #1E293B — subtle border */
--card: 213 25% 16%;            /* #1A2332 — card bg */
--card-foreground: 220 30% 95%;
--card-border: 213 24% 17%;     /* #1E293B */
--primary: 168 79% 50%;         /* #1BE3C2 — PT Green teal */
--primary-foreground: 216 47% 5%;
--secondary: 229 100% 68%;      /* #6079FF — Pendle Blue */
--secondary-foreground: 0 0% 100%;
--muted: 213 24% 17%;           /* #1E293B */
--muted-foreground: 213 30% 60%; /* ~#7B94BD — WATER-400 */
--accent: 213 20% 22%;          /* #2B3B55 — WATER-800 */
--accent-foreground: 220 30% 90%;
--destructive: 0 63% 60%;       /* #DD5453 */
--ring: 168 79% 50%;
--chart-1: 168 79% 50%;         /* #1BE3C2 teal */
--chart-2: 229 100% 68%;        /* #6079FF blue */
--chart-3: 192 55% 66%;         /* #72CDDF azure */
--chart-4: 43 84% 69%;          /* #F0CE74 gold */
--chart-5: 0 100% 79%;          /* #FF9393 guava */
```

### 2. index.css — Add Poppins font import and new utilities
- Add `--font-display: 'Poppins', sans-serif;` to :root
- Update gradient-bg class to be teal-to-blue
- Add `.glass-card` utility: background with blur + subtle border
- Add `.pendle-glow` utility for teal glow effects on hover

### 3. client/index.html — Add Poppins Google Fonts
Add Poppins to the Google Fonts link already loading Inter.

### 4. tailwind.config.ts
- Add `display: ["var(--font-display)"]` to fontFamily
- Ensure all color tokens are correctly mapped

### 5. Layout.tsx — Major Updates

#### Navbar:
- Replace the SVG logo with an `<img>` tag using `/brand/boros-by-pendle-logo.svg`
- Make logo image ~120px wide
- Background color: `rgba(13, 20, 32, 0.85)` with backdrop-blur
- Active nav link: teal underline (not bg highlight) to match Boros app
- CTA button: teal solid bg (#1BE3C2) with dark text, not gradient

#### Footer:
- Cleaner, more minimal
- Use Boros logo image in footer too (smaller)

#### StickyCTA:
- Background: same dark blur
- Button: teal solid

### 6. Home.tsx — Hero Section Overhaul
- Add a hero background: use `background-3-pendle.png` as a subtle bg image with overlay
- Use one of the Boros posters (e.g., `boros-poster-orbital-waves.png`) as a featured hero image
- Title: Use Poppins font (font-display class), larger sizing
- Subtitle: Use WATER-300 color (#9DAFCD)
- KPI stat cards: glass-card style with subtle borders
- Tool cards: hover glow effect (teal border glow on hover)
- Add the Boros logo image prominently in the hero

### 7. All Tool Pages (Terminal, Arbitrage, Simulator, Heatmap, Yields, Strategies)
- Page header backgrounds could alternate between brand background images
- Use the updated card styling (glass-card feel)
- Ensure chart tooltip styles match new palette
- Table styles: match Boros app (dark rows, teal highlights for positive, red for negative)
- Recharts colors must use the updated chart-1 through chart-5 vars

## CRITICAL RULES
1. Keep ALL functionality identical — only change visual appearance
2. Do NOT change any API calls, data handling, or routing
3. Keep the responsive/mobile design working
4. The Boros logo SVG is WHITE on transparent — it ONLY works on dark backgrounds
5. Hero images should be responsive and not make the page too heavy (use CSS background-image with cover)
6. Use `object-fit: cover` and `object-position: center` for poster images
7. Do NOT break any existing data-testid attributes
8. The font for headlines (h1, h2) should be Poppins; body text stays Inter
