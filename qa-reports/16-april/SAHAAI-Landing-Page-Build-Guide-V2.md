# SAHAAI Landing Page — Complete Build Guide for MiniMax (V2)

> **Purpose:** This document is a step-by-step instruction prompt for MiniMax M2.7 to build a modern, investor-grade landing page + sign-in page for SAHAAI (sahaai.tech). Read this ENTIRE document before writing any code.

---

## 1. PROJECT CONTEXT

**What is SAHAAI?**
SAHAAI = **S**mart **A**lgorithmic & **H**uman-**A**ssisted **A**I Trading Platform — India's first all-in-one paper trading, learning, and trading intelligence platform built exclusively for Indian retail F&O (Futures & Options) traders, with a primary focus on BankNifty options.

**Tagline:** _"Octopus Hands for the Traders"_

**Brand Story:** SAHAAI is not just a helping hand — it's **Octopus Hands** that assist traders across multiple dimensions simultaneously: learning, practicing, analyzing, journaling, backtesting, charting, socializing, and growing. The octopus metaphor represents multi-armed intelligence working in parallel to make traders better. It's the best learning & practice app to become a pro trader.

**Who will see this page?**
- Potential investors (primary audience for now)
- Future retail traders (BankNifty options traders in India)
- The page must look professional enough for an investor demo AND functional enough for real user sign-ups

**Tech Stack of the existing app:**
- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Railway (hosting), PostgreSQL (database)
- Fyers API v3 (live market data), Socket.io (real-time WebSocket)
- NextAuth.js (authentication), Prisma ORM
- Also available as PWA (Progressive Web App) for mobile

**Live URL:** https://sahaai.tech
**GitHub Repo:** Paper-Trading-Web-APP (private)

---

## 2. BRAND IDENTITY & DESIGN SYSTEM

### 2.1 Logo & Favicon
- The existing webapp already has logo and favicon files in the `public/` folder
- **Logo:** Look for files like `logo.png`, `logo.svg`, `sahaai-logo.*` in `public/` or `public/images/`
- **Favicon:** Look for `favicon.ico`, `favicon.png`, or icons referenced in `manifest.json` in `public/`
- The logo is an **octopus vector design** — use it prominently in the hero section
- **IMPORTANT:** Do NOT create new logos. Use the existing files from the repo's `public/` folder. Run `ls public/` to find exact filenames.

### 2.2 Color Palette
Use the existing app's dark trading theme as the base, enhanced for landing page impact:

```
Primary Background:    #0f172a (deep navy/slate — existing app bg)
Secondary Background:  #1e293b (card/section backgrounds)
Accent Primary:        #0ea5e9 (cyan/sky blue — trading energy)
Accent Secondary:      #f59e0b (amber/gold — premium, profits, octopus accent)
Success Green:         #16a34a (profit indicators)
Danger Red:            #dc2626 (loss/stop-loss indicators)
Text Primary:          #f1f5f9 (light gray on dark)
Text Secondary:        #94a3b8 (muted text)
Border:                #334155 (subtle borders)
Gradient Hero:         linear-gradient(135deg, #0f172a 0%, #1a1a2e 50%, #16213e 100%)
```

### 2.3 Typography
```
Headings:     "Plus Jakarta Sans" or "Outfit" (Google Fonts — modern, geometric, fintech feel)
Body:         "Inter" or "DM Sans" (clean readability)
Monospace:    "JetBrains Mono" (for any numbers, prices, code snippets)
```

### 2.4 Design Principles
- **Dark mode ONLY** — this is a trading app; traders live in dark mode
- **Glass-morphism** for cards (backdrop-filter: blur, semi-transparent backgrounds)
- **Subtle gradient meshes** in background (not flat solid colors)
- **Micro-animations** on scroll (elements fade/slide in as user scrolls)
- **Golden accents** for premium feel (octopus tentacle-inspired curved elements)
- **NO generic stock images** — use abstract geometric shapes, octopus tentacle curves, trading chart elements
- **Responsive** — must look perfect on mobile (PWA audience) and desktop

---

## 3. PAGE STRUCTURE — SECTION BY SECTION

The landing page is a single-page scrollable design with these sections in order:

---

### SECTION 1: NAVIGATION BAR (Sticky)

**Layout:** Horizontal bar, fixed to top, glass-morphism background (blur + transparency)

**Left side:**
- SAHAAI logo (from `public/` folder) — clickable, scrolls to top
- Brand name "SAHAAI" next to logo

**Center/Right side — Navigation Links (smooth scroll):**
- Features
- Learn
- Pricing
- Community
- About

**Right side — Auth Buttons:**
- "Sign In" button (outline style, light border) → opens sign-in modal/page
- "Start Free" button (solid accent cyan/sky blue, prominent CTA) → opens sign-up modal/page

**Mobile:** Hamburger menu that slides in from right

---

### SECTION 2: HERO SECTION (Full viewport height)

**This is the most important section — must be visually stunning for investors.**

**Background:**
- Deep gradient mesh (#0f172a → #1a1a2e → #16213e)
- Subtle animated particles or floating dots (representing market data flowing)
- Optional: faint octopus tentacle curves as decorative SVG lines in the background

**Layout (Desktop):** Two columns
- **Left column (60%):**
  - Small badge/pill above headline: "🇮🇳 Built for Indian F&O Traders" (with subtle border animation)
  - **Main Headline (H1):** "Octopus Hands for the Traders"
  - **Sub-headline:** "India's smartest paper trading & learning platform. Practice BankNifty options with live market data, proprietary signals with 70-80% accuracy, AI-powered pattern recognition, and a social trading community — all in one place. Zero risk. Real growth."
  - **CTA Buttons row:**
    - Primary: "Start Paper Trading — Free" (large, cyan/sky, glowing hover effect)
    - Secondary: "Watch Demo" (outline, with play icon ▶)
  - **Trust indicators row (small text/icons):**
    - "✓ Live Fyers Data Feed"
    - "✓ No Real Money at Risk"
    - "✓ Works on Mobile (PWA)"
    - "✓ Free Plan Available"
    - "✓ AI-Powered Insights"

- **Right column (40%):**
  - Mockup/screenshot of the SAHAAI trading dashboard (use a stylized browser frame or phone frame)
  - If no screenshot available, create a stylized illustration of a trading chart with buy/sell signals, candlesticks, and the octopus logo watermark
  - Add a subtle floating/parallax animation to this image

**Layout (Mobile):** Stack vertically — headline first, then image, then CTAs

---

### SECTION 3: SOCIAL PROOF / STATS BAR

**Layout:** Horizontal strip with 4 stat cards, slightly contrasting background (#1e293b)

Display these key numbers with animated count-up effect on scroll:

| Stat | Display |
|------|---------|
| "Proprietary Signal Accuracy" | "70-80%" |
| "Market Coverage" | "BankNifty + Full Options Chain" |
| "Pattern Match Engine" | "80%+ Match Retrieval" |
| "Risk" | "₹0 — Paper Trading" |

Each stat should have an icon above it and subtle gold underline accent.

---

### SECTION 4: FEATURES GRID — "Why SAHAAI?"

**Section Title:** "One Platform. Every Edge You Need."
**Section Subtitle:** "Like an octopus with powerful arms, SAHAAI handles every aspect of your trading journey simultaneously — more useful features than any other trading app available today."

**Layout:** Grid of feature cards (3 columns desktop, 1 column mobile). Each card has:
- Icon (use Lucide icons or simple SVG — NO emojis)
- Feature title
- 2-3 line description
- Subtle glass-morphism card with hover lift effect

**THE FEATURES (12 cards — octopus multi-arm metaphor):**

---

**Card 1 — Live Paper Trading**
Icon: chart-candlestick
Title: "Risk-Free Paper Trading"
Description: "Practice All NSE indices,MCX commodities & BankNifty options trading with real-time live data from Fyers. Place orders, manage positions, track P&L — all without risking a single rupee. Build confidence before going live."

---

**Card 2 — Real-Time Market Data & OI Analysis**
Icon: activity / signal
Title: "Live Market Data + OI Intelligence"
Description: "Real-time All NSE indices,MCX commodities spot price, complete option chain with live LTP, Greeks, and Open Interest data streamed via WebSocket. Plus AI-powered OI analysis reports to understand where the smart money is positioned — the same edge institutional traders use."

---

**Card 3 — Proprietary Trading Signals**
Icon: target / crosshair
Title: "Smart Trading Signals"
Description: "Our proprietary indicator generates high-accuracy BUY/SELL signals with a proven 70-80% success rate. Powered by advanced technical analysis combining multiple market dimensions. Signals fire only on confirmed candle closes — no false repaints."

---

**Card 4 — 🔥 Smart Trading Journal & Pattern Memory (HIGHLIGHT THIS CARD — make it visually distinct with a golden glow border and a "Star Feature" badge)**
Icon: brain / database
Title: "AI Pattern Memory Journal"
Description: "This is SAHAAI's superpower. Every trade you journal gets stored with full context — entry, exit, indicators, market conditions, your emotional state, and outcome. Over time, SAHAAI's AI identifies your successful patterns (80%+ match accuracy) and retrieves them in real-time during live markets. When a similar setup appears, you get an instant alert: 'This looks like your winning Pattern #47 — 83% historical success.' Turn your own experience into a pattern recognition engine."
**Additional callout text below this card:** "Your journal isn't just a diary — it's a self-learning AI that turns YOUR winning trades into future edge."

---

**Card 5 — Strategy Backtest Engine**
Icon: flask / test-tubes
Title: "Powerful Strategy Backtester"
Description: "Test any trading strategy or indicator combination on historical data with fine-grained control over entry rules, exit conditions, stop-loss logic, and multi-target profit booking. Customize every parameter — entry timing, SL type (fixed/indicator-based/trailing), partial exits at T1/T2/T3. Know your edge before risking capital."

---

**Card 6 — 🔥 Social Pattern Sharing & Community (HIGHLIGHT THIS CARD — golden glow border, "Community Power" badge)**
Icon: users / share-2
Title: "Social Trading Intelligence"
Description: "Access successful trading patterns shared by other SAHAAI traders. Every shared pattern is analyzed and validated by AI before being published — no noise, only quality setups. Follow top-performing paper traders, see their win rates, and get alerts when their high-confidence patterns match current market conditions. Compete in weekly & monthly paper trading competitions with leaderboards and rewards."
**Additional callout text below this card:** "Learn from the community's best patterns. Compete. Grow together."

---

**Card 7 — Option Strike Heat Maps**
Icon: grid / map
Title: "Option Strike Heat Maps"
Description: "Visual heat maps showing real-time activity across All NSE indices option strikes — OI buildup, OI change, volume concentration, and price movement intensity at a glance. Instantly spot where the market is building positions and which strikes are heating up. A visual shortcut to understanding market sentiment."

---

**Card 8 — Auto Hedging Strategy Builder**
Icon: shield / layers
Title: "Smart Hedging Strategy Builder"
Description: "Build complex option hedging strategies visually — Iron Condor, Bull Call Spread, Bear Put Spread, Straddle, Strangle, and more. Auto-selects optimal strikes based on current market data, calculates max profit, max loss, and breakeven points. One-click paper trade execution for the entire strategy leg."

---

**Card 9 — AI Custom Scanner & Indicator Builder**
Icon: search-code / wand
Title: "AI-Powered Custom Scanner & Indicator Creator"
Description: "Describe your trading idea in plain English — SAHAAI's AI writes the Python code for your custom scanner or indicator. 'Show me BankNifty options where OI increased 50% in last 3 candles and price is near support' — done. No coding knowledge needed. The AI builds, tests, and deploys your custom tools."
Badge: "Coming Soon" (small amber pill)

---

**Card 10 — 🔥 Curated Learning Hub (HIGHLIGHT — "Learn Smart" badge)**
Icon: graduation-cap / book-open
Title: "Curated Learning Resources"
Description: "Stop drowning in random YouTube videos. SAHAAI's Learning Hub filters and organizes the best trading education content into structured playlists — categorized by topic (options basics, Greeks, strategies, risk management, psychology), skill level (beginner/intermediate/advanced), and trading style. AI-curated to eliminate distractions and give you a focused, sequential learning path from zero to confident trader."
**Additional callout text below this card:** "No more tutorial overload. Learn the right thing, at the right time, in the right order."

---

**Card 11 — AI Market Analysis Reports**
Icon: file-text / newspaper
Title: "Daily & Real-Time AI Market Reports"
Description: "AI-generated market analysis based on crucial data points — OI analysis, support/resistance zones, FII/DII activity, sector rotation, global cues, and intraday momentum shifts. Delivered daily before market open and updated at key time intervals during trading hours. Understand the 'why' behind market moves, not just the 'what'."
Badge: "Coming Soon" (small amber pill)

---

**Card 12 — Trade Replay & AI Coach**
Icon: play-circle / sparkles
Title: "Trade Replay + AI Coaching"
Description: "Relive your trades bar-by-bar with full context replay. AI analyzes every trade — what you did right, what you could improve, and patterns in your behavior. Your 24/7 trading mentor that gets smarter with every trade you take."
Badge: "Coming Soon" (small amber pill)

---

### SECTION 5: HOW IT WORKS — 5-Step Flow

**Section Title:** "From Zero to Confident Trader in 5 Steps"

**Layout:** Horizontal timeline/stepper with connecting line (desktop), vertical stack (mobile)

**Step 1 — Sign Up Free**
Icon: user-plus
"Create your free account in 30 seconds. No credit card. No broker account needed to start."

**Step 2 — Learn Structured**
Icon: graduation-cap
"Follow curated learning paths from handpicked YouTube playlists. Organized by topic and skill level — no distractions, no information overload."

**Step 3 — Practice Paper Trading**
Icon: target
"Place paper orders on real live market data. Track your positions, set stop-losses and targets. Build real trading skills without real losses."

**Step 4 — Journal & Build Patterns**
Icon: brain
"Log every trade with context. SAHAAI's AI identifies your winning patterns over time and retrieves them during live markets when similar setups appear — 80%+ pattern matching."

**Step 5 — Compete & Grow**
Icon: trophy
"Join paper trading competitions, follow top traders' shared patterns (AI-validated), climb leaderboards, and refine your edge until you're ready for real markets."

---

### SECTION 6: PLATFORM SHOWCASE / SCREENSHOTS

**Section Title:** "See SAHAAI in Action"

**Layout:** Tabbed interface or horizontal carousel showing 4-5 key screens:

- **Tab 1: Dashboard** — Main trading dashboard with chart + order panel
- **Tab 2: Option Chain + Heat Map** — Live BankNifty option chain with LTP, OI, Greeks, and strike heat map visualization
- **Tab 3: Positions & Orders** — Active positions with P&L, pending orders
- **Tab 4: AI Pattern Journal** — Journal entries with emotion tags, pattern matching alerts, and AI insights
- **Tab 5: Learning Hub** — Curated YouTube playlists organized by category and skill level

**Implementation Note:** If actual screenshots are not available, create stylized placeholder mockups using the app's color scheme showing fake trading data. These placeholders should look realistic — use actual BankNifty-like price numbers (e.g., 52,450.35), option strike prices (52500 CE, 52000 PE), etc. For the heat map, show a grid of strikes with color intensity varying from cool blue (low activity) to hot red (high activity).

**Below the showcase:**
- Small text: "Available on Web & Mobile (PWA)"
- Two badges: "📱 Install as App" and "💻 Open in Browser" (both link to sahaai.tech)

---

### SECTION 7: PRICING PLANS

**Section Title:** "Simple, Transparent Pricing"
**Section Subtitle:** "Start free with 30% of features. Unlock 70% at India's most affordable trading platform price."

**Layout:** 3 pricing cards side by side (desktop), stack on mobile. Starter plan should be visually highlighted as "Best Value" with a gold border/glow.

**Plan 1 — FREE**
- Price: ₹0 / forever
- Color accent: Gray
- Badge: "Get Started"
- Features (30% of platform):
  - Paper trading with live data
  - Basic trade journal (30 days history)
  - Live charts (basic timeframes)
  - Option chain viewer
  - Community access (read-only)
  - Learning Hub (beginner playlists only)
  - Daily AI market summary (1 per day)
- CTA: "Start Free"

**Plan 2 — STARTER** ⭐ (Best Value badge — highlighted with gold border glow)
- Price: ₹300 / 3 months (display as "Just ₹100/month")
- Color accent: Cyan (#0ea5e9)
- Highlighted with gold border glow
- Features (70% of platform):
  - Everything in Free, plus:
  - Full trade journal with screenshots & emotion tagging
  - AI Pattern Memory — 80%+ match retrieval on live market
  - Strategy backtesting engine with custom rules
  - Option strike heat maps
  - Hedging strategy builder (Iron Condor, spreads, etc.)
  - Social pattern access (view & follow top traders)
  - Paper trading competitions & leaderboards
  - Learning Hub (all levels, all categories)
  - Telegram alerts
  - AI market reports (3x daily)
  - Trade Replay (when available)
- CTA: "Get Started — ₹300/3 months"

**Plan 3 — PRO**
- Price: ₹599/month (or ₹1,499/3 months)
- Color accent: Gold (#f59e0b)
- Features (100% of platform):
  - Everything in Starter, plus:
  - AI Custom Scanner & Indicator Builder (describe in English → AI creates Python code)
  - Advanced AI Trade Coaching & behavioral insights
  - AI Pattern Memory — unlimited pattern storage & cross-user AI insights
  - Priority real-time AI market reports (every key market interval)
  - WhatsApp alerts
  - Social pattern sharing (publish your own patterns)
  - Monthly challenge rewards & badges
  - Mentor–Student mode
  - Priority support
  - Early access to all new features
- CTA: "Go Pro"

**Below pricing:**
- "All paid plans include live Fyers data feed and real-time WebSocket streaming."
- "Switch plans anytime. No lock-in contracts. Cancel whenever."
- "🎉 Launch offer: First 500 users get Starter plan at ₹300/3 months — locked for life."

---

### SECTION 8: UNIQUE ADVANTAGES (replaces competitive comparison)

**Section Title:** "More Features Than Any Other Trading App"
**Section Subtitle:** "We built everything traders actually need — in one place."

**Layout:** A visually striking checklist-style section. NOT a comparison table with competitor names. Instead, show a grid of "advantage pills" or a feature wall.

**Design:** Two columns (desktop). Left column: list of features SAHAAI offers. Right column: a visual element like an octopus illustration with tentacles pointing to each feature.

**Feature list (display as check-marked items with brief one-liners):**

✅ Paper trading with live Fyers data feed
✅ AI Pattern Memory Journal — stores your winning setups, retrieves them in real-time (80%+ match)
✅ Social pattern sharing — access AI-validated patterns from top traders
✅ Paper trading competitions with leaderboards & rewards
✅ Strategy backtesting engine with fully customizable entry/exit/target rules
✅ Option strike heat maps for instant market sentiment reading
✅ Auto hedging strategy builder (Iron Condor, spreads, straddle, strangle)
✅ AI-powered custom scanner & indicator creation — describe in English, get Python code
✅ Curated learning playlists — best YouTube content organized by topic & level
✅ Daily & real-time AI market analysis reports (OI analysis, S/R zones, FII/DII data)
✅ Trade journal with emotion tagging & screenshot capture
✅ Trade Replay — relive trades bar-by-bar
✅ AI Trade Coaching — personalized insights from your trade history
✅ Professional charts with multiple timeframes
✅ PWA mobile app — install and trade from anywhere
✅ Smart trading signals with 70-80% accuracy

**Closing line (bold, centered):**
"Most trading apps give you one or two of these. SAHAAI gives you ALL of them — starting free."

---

### SECTION 9: MARKET OPPORTUNITY (Investor-focused)

**Section Title:** "The Opportunity"

**Layout:** 3-4 large stat cards with brief context

**Stat 1:** "1.5 Crore+ Active F&O Traders in India"
Subtext: "And growing 30%+ year over year"

**Stat 2:** "USD 1.08B → 2.61B"
Subtext: "Indian online trading platform market CAGR projection"

**Stat 3:** "9 out of 10 Retail Traders Lose Money"
Subtext: "SEBI study confirms the problem SAHAAI solves"

**Stat 4:** "SEBI 2025 Retail Algo Framework"
Subtext: "New regulations creating massive opportunity for compliant trading platforms"

---

### SECTION 10: ABOUT / FOUNDER

**Section Title:** "Built by a Trader, for Traders"

**Layout:** Brief founder card

**Content:**
"SAHAAI is built by an active BankNifty options trader with deep expertise in technical analysis, proprietary indicator development, and advanced backtesting systems. Every feature exists because it solves a real problem faced during actual trading — not because a product manager imagined it in a boardroom."

"The vision: Paper → Trust → Live. No trader should risk real money until they've proven their edge with paper trading and pattern recognition."

**Key Credentials (displayed as small pills/badges):**
- Active BankNifty Options Trader
- Technical Analysis Expert
- Proprietary Indicator Developer
- Full-Stack Platform Builder

---

### SECTION 11: CTA BANNER

**Layout:** Full-width banner with gradient background (cyan → amber subtle diagonal)

**Headline:** "Ready to Trade Smarter?"
**Subtext:** "Join SAHAAI — India's most feature-rich paper trading & learning platform. Free to start."
**Button:** "Create Free Account" (large, white on cyan, glowing)
**Secondary text:** "Join 🐙 and let the Octopus Hands guide your trading journey."

---

### SECTION 12: FOOTER

**Layout:** Dark background (#0b1120), multi-column

**Column 1 — Brand:**
- SAHAAI logo
- Tagline: "Octopus Hands for the Traders"
- Brief 1-liner: "India's smartest paper trading, learning & social intelligence platform for F&O traders."

**Column 2 — Platform:**
- Features
- Pricing
- How It Works
- PWA Install Guide
- Learning Hub

**Column 3 — Community:**
- Competitions
- Leaderboards
- Share Patterns
- Telegram Group (placeholder)

**Column 4 — Resources:**
- Blog (placeholder link)
- Documentation (placeholder)
- Release Notes (placeholder)

**Column 5 — Legal:**
- Privacy Policy (placeholder)
- Terms of Service (placeholder)
- Refund Policy (placeholder)
- Contact Us

**Bottom bar:**
- "© 2025 SAHAAI. All rights reserved."
- Social media icon placeholders (Twitter/X, LinkedIn, Telegram, YouTube)

---

## 4. SIGN-IN / SIGN-UP PAGE DESIGN

**This is critical — users will sign in directly from the landing page.**

### 4.1 Implementation Approach
The sign-in should work as a **modal overlay** that appears on top of the landing page (not a separate route). When user clicks "Sign In" or "Start Free" from the navbar or any CTA, a centered modal slides in with a backdrop blur.

### 4.2 Sign-In Modal Design

**Background:** Semi-transparent dark overlay with backdrop-filter blur
**Modal container:** Glass-morphism card (max-width: 440px), centered

**Left/Top section of modal:**
- SAHAAI octopus logo (from `public/` folder)
- "Welcome Back" (for sign-in) or "Create Your Account" (for sign-up)
- Subtle octopus tentacle decorative curve in the background of the modal

**Form Fields:**

**Sign-In Mode:**
- Email input (with mail icon)
- Password input (with lock icon, show/hide toggle)
- "Remember me" checkbox
- "Forgot Password?" link
- "Sign In" button (full width, cyan accent, bold)
- Divider line with "or"
- "Don't have an account? Sign Up" toggle link

**Sign-Up Mode (toggle from sign-in):**
- Full Name input
- Email input
- Password input (with strength indicator)
- Confirm Password input
- "I agree to Terms of Service" checkbox
- "Create Account" button (full width, cyan accent)
- Divider line with "or"
- "Already have an account? Sign In" toggle link

### 4.3 Technical Integration
- The sign-in form must POST to the existing NextAuth.js credentials provider
- Sign-in endpoint: `/api/auth/callback/credentials`
- Sign-up endpoint: `/api/auth/signup` (or create if not exists)
- After successful sign-in → redirect to `/dashboard` (the main trading app)
- After successful sign-up → redirect to `/dashboard`
- Use `signIn('credentials', { email, password, redirect: true, callbackUrl: '/dashboard' })` from `next-auth/react`

### 4.4 Visual Details
- Inputs should have dark backgrounds (#1e293b), light borders (#334155), white text
- Focus state: cyan border glow
- Error state: red border + error message below field
- Loading state: button shows spinner, inputs disabled
- Success: brief checkmark animation before redirect
- Modal close: click outside or X button returns to landing page

---

## 5. TECHNICAL IMPLEMENTATION INSTRUCTIONS

### 5.1 File Structure
Create these files in the existing Next.js project:

```
src/
├── app/
│   ├── page.tsx                    ← REPLACE with landing page (currently may redirect to /dashboard)
│   ├── landing/
│   │   ├── page.tsx                ← Alternative: landing page as separate route
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       ├── HeroSection.tsx
│   │       ├── StatsBar.tsx
│   │       ├── FeaturesGrid.tsx
│   │       ├── HowItWorks.tsx
│   │       ├── PlatformShowcase.tsx
│   │       ├── PricingPlans.tsx
│   │       ├── UniqueAdvantages.tsx    ← Replaces ComparisonTable
│   │       ├── MarketOpportunity.tsx
│   │       ├── AboutFounder.tsx
│   │       ├── CTABanner.tsx
│   │       ├── Footer.tsx
│   │       └── AuthModal.tsx       ← Sign-in / Sign-up modal
│   └── ...
```

### 5.2 Routing Logic
- **Unauthenticated users** visiting `sahaai.tech` → see the landing page
- **Authenticated users** visiting `sahaai.tech` → redirect to `/dashboard`
- Check auth status using `getServerSession()` or `useSession()` from NextAuth

### 5.3 Key Dependencies (already in project or add)
```json
{
  "framer-motion": "latest",        // for scroll animations and modal
  "lucide-react": "latest",         // for icons (likely already installed)
  "next-auth": "already installed",
  "tailwindcss": "already installed"
}
```

If framer-motion is not installed, use CSS animations with Intersection Observer for scroll effects.

### 5.4 Performance Requirements
- Lazy load sections below the fold
- Optimize images (use Next.js `<Image>` component with WebP)
- Use `loading="lazy"` for images below fold
- Total landing page should load in under 3 seconds
- Lighthouse score target: 90+ performance

### 5.5 SEO Meta Tags
Add these to the landing page `<head>`:
```
title: "SAHAAI — Octopus Hands for the Traders | India's Smartest Paper Trading & Learning Platform"
description: "Practice ALL NSE Indices, MCX commodities & BankNifty options trading with live market data, proprietary signals with 70-80% accuracy, AI pattern recognition journal, social trading community, option heat maps, curated learning — all risk-free. India's first all-in-one trading intelligence platform."
og:image: SAHAAI logo or hero screenshot
og:type: website
og:url: https://sahaai.tech
twitter:card: summary_large_image
```

---

## 6. ANIMATION & INTERACTION SPECS

### 6.1 Scroll Animations
- Each section fades in + slides up (translateY: 30px → 0) when it enters viewport
- Stagger child elements within sections (cards appear one by one, 100ms delay)
- Use `IntersectionObserver` or framer-motion's `whileInView`

### 6.2 Specific Animations
- **Hero section:** Headline text types in letter by letter OR fades in word by word. The dashboard mockup image has a subtle float/parallax effect.
- **Stats bar:** Numbers count up from 0 when scrolled into view
- **Feature cards:** Scale from 0.95 → 1.0 and opacity 0 → 1 on scroll. The 3 highlighted cards (Pattern Journal, Social, Learning Hub) should have a subtle golden shimmer/pulse on their border.
- **Pricing cards:** The "Best Value" Starter card has a subtle pulse glow on its gold border
- **CTA button hover:** Subtle glow expansion effect (box-shadow spread increases)
- **Navbar:** Transparent on top, adds glass-morphism background after scrolling 100px
- **Unique Advantages section:** Each checkmark item animates in sequentially (stagger effect) as user scrolls

### 6.3 Auth Modal Animation
- Backdrop fades in (opacity 0 → 1)
- Modal slides up from bottom (translateY: 50px → 0) with spring easing
- Sign-in ↔ Sign-up toggle: cross-fade transition between forms

---

## 7. RESPONSIVE BREAKPOINTS

```
Mobile:    < 640px   — Single column, stacked sections, hamburger nav
Tablet:    640-1024px — 2-column grids, condensed spacing
Desktop:   > 1024px  — Full layout as described above
```

### Mobile-Specific Adjustments:
- Hero headline: smaller font (2rem instead of 3.5rem)
- Feature grid: single column, swipeable horizontal on mobile
- Pricing: horizontal scroll or accordion
- Unique Advantages: single column checklist
- Navbar: hamburger menu with slide-in drawer
- Auth modal: full screen on mobile instead of centered modal
- CTAs: full-width buttons on mobile

---

## 8. IMPORTANT RESTRICTIONS — READ CAREFULLY

### ❌ DO NOT include or reveal:
1. **CCC Indicator details** — Do NOT mention "CCC", "Confirmation Colour Candles", "SuperTrend", "ATR", "EMA5", "SAHA line", or any internal indicator logic/parameters/values. Only say "proprietary indicator" or "smart trading signals" with "70-80% accuracy."
2. **Algo Bot** — Do NOT mention algo bot, automated trading bot, Python bot, Phase 2, or any automated execution system. This is an internal tool, not a public feature.
3. **Phase numbers or development stages** — Don't reference Phase 1/2/3/4/5 or any internal roadmap.
4. **Technical architecture details** — Don't mention Railway, Prisma, Zustand, or backend specifics on the public landing page. Fyers API is okay to mention as data source.
5. **Backtester win rate specifics** — Don't say "40.4% win rate" or "423 signals on 6,755 bars". Only reference the indicator's accuracy as "70-80% after fine-tuning."
6. **Gann or Fibonacci by name** — Do NOT mention "Gann Square of 9", "Fibonacci", "Fibonacci extensions", or any specific indicator/method names. Only say "strategy backtesting engine" with "customizable entry, exit, and target rules."
7. **Competitor names** — Do NOT mention Sensibull, Streak, Opstra, SpeedBot, AlgoBulls, or any competitor brand names. Only say "more features than other trading apps" generically.

### ✅ DO include:
- The octopus brand metaphor prominently
- Live Fyers data feed as a selling point
- Strategy backtesting engine (generic — customizable rules, no specific indicator names)
- **AI Pattern Memory Journal** as the STAR feature — pattern storage → 80% match → live retrieval
- **Social pattern sharing & community competitions** as a major differentiator
- **Curated Learning Hub** with filtered YouTube playlists as a unique value
- **Option strike heat maps** and **auto hedging strategy builder** as new features
- **AI custom scanner/indicator builder** (describe in English → Python code)
- **Daily AI market analysis reports** (OI analysis, S/R zones, FII/DII data)
- Trade Replay and AI Coaching as "Coming Soon" features
- Market opportunity numbers for investors
- Clear pricing: Free (30%), ₹300/3mo Starter (70%), ₹599/mo Pro (100%)
- Working sign-in/sign-up that integrates with NextAuth.js

---

## 9. STEP-BY-STEP BUILD ORDER FOR MINIMAX

Follow this exact sequence:

**Step 1:** Read the existing project structure. Run `ls src/app/` and `ls public/` to understand what files exist. Find the logo and favicon files.

**Step 2:** Check `src/app/page.tsx` — understand the current root page behavior (does it redirect to dashboard? is it a login page?). Check `src/app/layout.tsx` for existing providers and wrappers.

**Step 3:** Check `package.json` for already installed packages (framer-motion? lucide-react? etc.)

**Step 4:** Plan the routing — decide whether landing page replaces `page.tsx` or lives at `/landing`. Authenticated users should still go to `/dashboard`. Unauthenticated users see landing page.

**Step 5:** Build the `AuthModal.tsx` component first — this is the highest-priority functional component. Make sure it connects to NextAuth.js correctly.

**Step 6:** Build the landing page sections top to bottom:
- Navbar (with auth modal trigger)
- Hero Section
- Stats Bar
- Features Grid (12 cards, with 3 highlighted)
- How It Works (5 steps)
- Platform Showcase
- Pricing Plans (3 tiers: Free / Starter / Pro)
- Unique Advantages (checklist, NOT competitor comparison)
- Market Opportunity
- About / Founder
- CTA Banner
- Footer

**Step 7:** Add scroll animations and micro-interactions.

**Step 8:** Test responsive design at mobile, tablet, and desktop breakpoints.

**Step 9:** Verify sign-in flow works end-to-end (sign in → redirects to /dashboard).

**Step 10:** Run `npm run build` to verify no TypeScript or build errors.

---

## 10. QUALITY CHECKLIST

Before marking as complete, verify:

- [ ] Landing page loads at sahaai.tech for unauthenticated users
- [ ] Authenticated users are redirected to /dashboard
- [ ] Sign-in modal opens from navbar "Sign In" button
- [ ] Sign-up modal opens from "Start Free" or "Get Started" buttons
- [ ] Sign-in successfully authenticates and redirects to /dashboard
- [ ] Sign-up creates account and redirects to /dashboard
- [ ] All 12 feature cards display correctly
- [ ] 3 highlighted cards (Pattern Journal, Social, Learning Hub) have golden glow borders
- [ ] Pricing section shows 3 plans with correct prices (Free / ₹300 per 3mo / ₹599/mo)
- [ ] No competitor names appear anywhere on the page
- [ ] No Gann, Fibonacci, CCC, or specific indicator names appear anywhere
- [ ] Unique Advantages section has checklist format (not comparison table)
- [ ] All scroll animations work smoothly
- [ ] Navbar becomes glass-morphism on scroll
- [ ] Mobile hamburger menu works
- [ ] SAHAAI logo displays correctly from existing `public/` files
- [ ] No CCC indicator details visible anywhere
- [ ] No algo bot mentioned anywhere
- [ ] No build errors (`npm run build` passes)
- [ ] Page loads in under 3 seconds
- [ ] SEO meta tags are in place

---

## 11. REFERENCE: COMPLETE COPY BLOCKS

Below are the exact text blocks to use. Do not improvise the feature descriptions — use these as written.

### Hero Headline Options (pick one):
1. "Octopus Hands for the Traders"
2. "Eight Arms. One Mission. Make You a Better Trader."
3. "Your Octopus-Powered Trading Intelligence Platform"

### Hero Sub-headline:
"India's first all-in-one paper trading & learning platform built for All NSE Indices & MCX Commodities Future & options  traders. Practice with live market data, proprietary signals with 70-80% accuracy, AI pattern recognition that learns YOUR winning trades, social trading community, curated learning paths, and advanced analytics — zero financial risk."

### Value Proposition (for investors section):
"9 out of 10 retail traders in India lose money (SEBI, 2023). SAHAAI bridges the gap between theory and profitable trading by providing the tools, practice environment, social community, learning resources, and AI-powered pattern intelligence that help retail traders build proven, profitable strategies before risking real capital."

### Pattern Journal Tagline:
"Your journal isn't just a diary — it's a self-learning AI that turns YOUR winning trades into future edge. 80%+ pattern match accuracy on live market conditions."

### Social Feature Tagline:
"Follow top paper traders. Access AI-validated patterns. Compete in trading challenges. Grow together."

### Learning Hub Tagline:
"No more tutorial overload. The best trading education from YouTube — filtered, organized, and sequenced by AI. Learn the right thing, at the right time."

---

**END OF DOCUMENT — This is the complete V2 specification. Build it exactly as described.**
