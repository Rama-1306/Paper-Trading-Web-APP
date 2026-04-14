# SAHAAI Paper Trading — Mobile PWA UI Fix: Complete Plan for Minimax

## CONTEXT

This is a **Next.js 16 App Router** paper trading web app with a recent desktop redesign called  
**"WU Precision Ledger"** (light theme: cream/gold palette). The PWA mobile experience is currently  
**completely broken** because the new layout components (SideNav, TradingSidebar) have no mobile  
responsiveness, and several components still contain hardcoded dark-theme colors from the old design.

**Tech stack:** Next.js 16, TypeScript, Tailwind CSS v3, Zustand stores, Lightweight Charts, Socket.IO  
**Primary working directory:** `src/`  
**Style system:** Tailwind classes for new WU components; legacy CSS classes in `src/app/globals.css`  
**Mobile breakpoint:** Tailwind `md:` = 768px (phones < 768px get mobile layout)

**DO NOT change any business logic, API calls, Zustand store usage, socket connections, or data fetching.  
ONLY change layout, CSS, colors, and responsive behavior.**

---

## WU LIGHT THEME REFERENCE COLORS

Use these values consistently for all fixes:

```
Background (page):      #fbf9f5   (Tailwind: bg-surface)
Surface container:      #f5f3ef   (Tailwind: bg-surface-container)
Surface low:            #f0ede6   (Tailwind: bg-surface-container-low)
Border:                 #e4e2de   (Tailwind: border-surface-dim or var(--border-primary))
Primary text:           #1b1c1a   (Tailwind: text-on-background)
Muted text:             #80765f   (Tailwind: text-on-surface-variant)
Accent/Primary:         #745b00   (CSS var: --color-accent)
Accent highlight:       #ffcc00   (Tailwind: bg-primary-container)
Profit green:           #00875a   (CSS var: --color-profit)
Loss red:               #ba1a1a   (CSS var: --color-loss)
Dark header (panels):   #1b1c1a   (used intentionally for panel toolbars only)
```

---

## MOBILE UX FLOW (TARGET STATE)

On mobile (< 768px), the app should work like this:

```
┌─────────────────────────────┐
│  TopNav (64px, full width)  │  ← Light theme, logo + bell + avatar only
├─────────────────────────────┤
│                             │
│   Full-width page content   │  ← NO left margin, NO desktop sidebar
│   (scrollable if needed)    │
│                             │
│                             │
│                             │
├─────────────────────────────┤
│  Mobile Bottom Nav (56px)   │  ← WU light theme, 6 tabs
└─────────────────────────────┘
```

**Mobile bottom nav tabs:** Chart | Positions | Orders | Trades | Watch | Alerts  
**SideNav:** Hidden on mobile (desktop-only 80px icon rail)  
**TradingSidebar (Order+Positions panel):** Hidden on mobile  
**StatusBar:** Hidden on mobile (it's a 28px footer with market hours — not useful on phone)  
**Place Order on mobile:** Accessible via a floating "+" button on the `/trade` chart page  
  that opens an **OrderPanel bottom sheet** (slides up from bottom of screen)

---

## ISSUES TO FIX — COMPLETE LIST

### ISSUE 1: SideNav appears on mobile (80px wasted space + hover expands to 256px)

**File:** `src/components/common/SideNav.tsx`

**Problem:** The `<aside>` has no responsive class. On a 375px phone, 80px is wasted on the left.  
On touch-hover, it expands to 256px and blocks all content.

**Fix:** Add `hidden md:flex` to the `<aside>` element so it only shows on desktop.

```tsx
// BEFORE (line 34):
<aside className="fixed left-0 top-0 h-full z-40 flex flex-col pt-16 bg-surface-container-low w-20 hover:w-64 transition-all duration-300 group overflow-hidden border-r border-surface-dim/20">

// AFTER:
<aside className="hidden md:flex fixed left-0 top-0 h-full z-40 flex-col pt-16 bg-surface-container-low w-20 hover:w-64 transition-all duration-300 group overflow-hidden border-r border-surface-dim/20">
```

---

### ISSUE 2: ml-20 left margin hardcoded on ALL pages (no responsive)

**Files:**
- `src/app/trade/page.tsx` — line ~163: `<div className="flex flex-1 ml-20 overflow-hidden">`
- `src/app/positions/page.tsx` — line ~54: `<div className="flex flex-1 ml-20 overflow-hidden">`
- `src/app/orders/page.tsx` — line ~53: `<div className="flex flex-1 ml-20 overflow-hidden">`
- `src/app/trades/page.tsx` — line ~53: `<div className="flex flex-1 ml-20 overflow-hidden">`
- `src/app/watchlist/page.tsx` — line ~53: `<div className="flex flex-1 ml-20 overflow-hidden">`
- `src/app/alerts/page.tsx` — line ~53: `<div className="flex flex-1 ml-20 overflow-hidden">`
- `src/app/signal-log/page.tsx` — line ~135: `<div className="flex flex-1 ml-20 overflow-hidden">`
- `src/app/page.tsx` (dashboard) — line ~108: `<main className="flex-1 ml-20 p-8 lg:p-12">`

**Problem:** `ml-20` (80px margin for the SideNav) shows on all screen sizes.  
On a 375px phone this wastes 21% of screen width.

**Fix:** Change `ml-20` to `md:ml-20` on every one of these files.

```tsx
// BEFORE (example — apply same pattern to ALL 8 files above):
<div className="flex flex-1 ml-20 overflow-hidden">

// AFTER:
<div className="flex flex-1 md:ml-20 overflow-hidden">
```

For the dashboard page specifically:
```tsx
// BEFORE:
<main className="flex-1 ml-20 p-8 lg:p-12">

// AFTER:
<main className="flex-1 md:ml-20 p-4 md:p-8 lg:p-12">
```

---

### ISSUE 3: TradingSidebar (320px) always visible — takes almost full screen on mobile

**File:** `src/components/common/TradingSidebar.tsx`

**Problem:** `<aside className="w-80 shrink-0 ...">` is rendered on every page with no `hidden md:flex`.  
On 375px phone: 320px sidebar + layout = nothing visible for content. Completely unusable.

**Fix — Part A:** Make the sidebar desktop-only:
```tsx
// BEFORE (line 15 in TradingSidebar.tsx):
<aside className="w-80 shrink-0 border-l border-surface-container-highest flex flex-col overflow-hidden bg-surface-container-lowest">

// AFTER:
<aside className="hidden md:flex w-80 shrink-0 border-l border-surface-container-highest flex-col overflow-hidden bg-surface-container-lowest">
```

**Fix — Part B:** On `/trade` page only, add a mobile floating "Place Order" button.  
Add this JSX just before `</ProtectedRoute>` in `src/app/trade/page.tsx`:

```tsx
{/* ── Mobile: Floating Order Button + Bottom Sheet ── */}
<MobileOrderSheet />
```

**Create new file:** `src/components/common/MobileOrderSheet.tsx`

```tsx
'use client';

import { useState } from 'react';
import { OrderPanel } from '@/components/Trading/OrderPanel';

export function MobileOrderSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating "+" button — only on mobile, above bottom nav */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-16 right-4 z-50 w-14 h-14 rounded-full bg-primary-container text-on-primary-fixed shadow-lg flex items-center justify-center text-2xl font-bold transition-transform active:scale-95"
        aria-label="Place Order"
      >
        +
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-50"
            onClick={() => setOpen(false)}
          />
          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-surface-container-highest">
              <div className="w-10 h-1 bg-surface-dim rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant pt-2">
                Place Order
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-on-surface-variant hover:text-on-surface text-xl leading-none pt-2"
              >
                ✕
              </button>
            </div>
            {/* OrderPanel fills the sheet */}
            <OrderPanel />
          </div>
        </>
      )}
    </>
  );
}
```

**Also add the import** at the top of `src/app/trade/page.tsx`:
```tsx
import { MobileOrderSheet } from '@/components/common/MobileOrderSheet';
```

---

### ISSUE 4: StatusBar overlaps mobile bottom nav

**File:** `src/components/common/StatusBar.tsx`

**Problem:** StatusBar is `position: fixed; bottom: 0; z-index: 40` (CSS class `.status-bar`).  
The mobile-bottom-nav is also `position: fixed; bottom: 0; z-index: 100`.  
They stack on top of each other. On desktop it's fine (nav is `display: none` on md+).  
On mobile the StatusBar is 28px tall and partially visible under the nav.

**Fix:** Hide StatusBar completely on mobile by adding `hidden md:flex` to the footer:

```tsx
// BEFORE (line 35 in StatusBar.tsx):
<footer className="status-bar" style={{ ... }}>

// AFTER:
<footer className="status-bar hidden md:flex" style={{ ... }}>
```

---

### ISSUE 5: Mobile bottom nav uses old dark theme (#1b1c1a) — update to WU light theme

**File:** `src/app/globals.css`

**Problem:** The mobile bottom nav uses the old dark app colors. The rest of the app is now light.

**Find this block** (around line 454):
```css
.mobile-bottom-nav {
  display: flex;
  justify-content: space-around;
  background: #1b1c1a;
  border-top: 1px solid #2a2d35;
  padding: 8px 0;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

@media (min-width: 768px) {
  .mobile-bottom-nav {
    display: none;
  }
}

.mobile-nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: #8b8f98;
  cursor: pointer;
  font-size: 9px;
}

.mobile-nav-tab.active {
  color: #d4a012;
}

.mobile-nav-icon {
  font-size: 18px;
}
```

**Replace the entire block with:**
```css
.mobile-bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: #ffffff;
  border-top: 1px solid #e4e2de;
  padding: 6px 0 max(6px, env(safe-area-inset-bottom));
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}

@media (min-width: 768px) {
  .mobile-bottom-nav {
    display: none;
  }
}

.mobile-nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 12px;
  background: transparent;
  border: none;
  color: #80765f;
  cursor: pointer;
  font-size: 9px;
  text-decoration: none;
  min-width: 48px;
  -webkit-tap-highlight-color: transparent;
}

.mobile-nav-tab.active {
  color: #745b00;
}

.mobile-nav-icon {
  font-size: 20px;
  line-height: 1;
}

.mobile-nav-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
```

---

### ISSUE 6: Page content bottom padding missing — mobile nav covers last items

**Problem:** All pages have content that scrolls behind the fixed mobile bottom nav (56px tall).  
Users cannot tap the last items in lists.

**Fix:** Add bottom padding to the scrollable content areas in each page.  
The scrollable `div` on each page has `flex-1 overflow-auto`. Add `pb-16` (64px) to it on mobile.

Apply this change to these files:
- `src/app/positions/page.tsx`
- `src/app/orders/page.tsx`
- `src/app/trades/page.tsx`
- `src/app/watchlist/page.tsx`
- `src/app/alerts/page.tsx`
- `src/app/signal-log/page.tsx`

```tsx
// BEFORE (in each page):
<div className="flex-1 overflow-auto">

// AFTER:
<div className="flex-1 overflow-auto pb-16 md:pb-0">
```

For the dashboard `src/app/page.tsx`, find the main scrollable container and add:
```tsx
// BEFORE:
<main className="flex-1 md:ml-20 p-4 md:p-8 lg:p-12">

// AFTER:
<main className="flex-1 md:ml-20 p-4 md:p-8 lg:p-12 pb-20 md:pb-12">
```

---

### ISSUE 7: TradingChart hardcoded dark background — does not match WU light theme

**File:** `src/components/Chart/TradingChart.tsx` (lines 32–78)

**Problem:** Chart background is `#0a0e17` (dark navy), grid lines are near-invisible white.  
On a light-theme app, this looks like a dark hole in the interface.

**Find the `createChart` call** and replace the entire options object:

```tsx
// BEFORE:
const chart = createChart(chartContainerRef.current, {
  layout: {
    background: { color: '#0a0e17' },
    textColor: '#8b8f98',
    fontSize: 11,
    fontFamily: "'Inter', sans-serif",
  },
  grid: {
    vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
    horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
  },
  crosshair: {
    mode: 0,
    vertLine: {
      color: 'rgba(99, 102, 241, 0.4)',
      width: 1,
      style: 2,
      labelBackgroundColor: '#6366f1',
    },
    horzLine: {
      color: 'rgba(99, 102, 241, 0.4)',
      width: 1,
      style: 2,
      labelBackgroundColor: '#6366f1',
    },
  },
  rightPriceScale: {
    borderColor: 'rgba(255, 255, 255, 0.06)',
    scaleMargins: { top: 0.1, bottom: 0.1 },
  },
  timeScale: {
    borderColor: 'rgba(255, 255, 255, 0.06)',
    timeVisible: true,
    secondsVisible: false,
    shiftVisibleRangeOnNewBar: false,
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: false,
  },
  handleScale: {
    axisPressedMouseMove: true,
    mouseWheel: true,
    pinch: true,
  },
});

// AFTER:
const chart = createChart(chartContainerRef.current, {
  layout: {
    background: { color: '#fbf9f5' },
    textColor: '#4e4632',
    fontSize: 11,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  grid: {
    vertLines: { color: 'rgba(0, 0, 0, 0.04)' },
    horzLines: { color: 'rgba(0, 0, 0, 0.04)' },
  },
  crosshair: {
    mode: 0,
    vertLine: {
      color: 'rgba(116, 91, 0, 0.4)',
      width: 1,
      style: 2,
      labelBackgroundColor: '#745b00',
    },
    horzLine: {
      color: 'rgba(116, 91, 0, 0.4)',
      width: 1,
      style: 2,
      labelBackgroundColor: '#745b00',
    },
  },
  rightPriceScale: {
    borderColor: '#e4e2de',
    scaleMargins: { top: 0.1, bottom: 0.1 },
  },
  timeScale: {
    borderColor: '#e4e2de',
    timeVisible: true,
    secondsVisible: false,
    shiftVisibleRangeOnNewBar: false,
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: false,
  },
  handleScale: {
    axisPressedMouseMove: true,
    mouseWheel: true,
    pinch: true,
  },
});
```

**Also update the candlestick series colors** (just below the createChart call):
```tsx
// BEFORE:
const candlestickSeriesInstance = chart.addSeries(CandlestickSeries, {
  upColor: '#00e676',
  downColor: '#ff1744',
  borderUpColor: '#00e676',
  borderDownColor: '#ff1744',
  wickUpColor: '#00e67688',
  wickDownColor: '#ff174488',
});

// AFTER:
const candlestickSeriesInstance = chart.addSeries(CandlestickSeries, {
  upColor: '#00875a',
  downColor: '#ba1a1a',
  borderUpColor: '#00875a',
  borderDownColor: '#ba1a1a',
  wickUpColor: '#00875a99',
  wickDownColor: '#ba1a1a99',
});
```

---

### ISSUE 8: Toast container too wide for mobile (420px > 375px phone width)

**File:** `src/app/globals.css`

**Find this block** (around line 108):
```css
.toast-container {
  position: fixed;
  top: 80px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  ...
  min-width: 300px;
  max-width: 420px;
  ...
}
```

**Replace with:**
```css
.toast-container {
  position: fixed;
  top: 70px;
  right: 8px;
  left: 8px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

@media (min-width: 768px) {
  .toast-container {
    left: auto;
    right: 16px;
    top: 80px;
  }
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #d2c5ab;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 420px;
  animation: slideIn 0.3s ease-out;
  backdrop-filter: blur(12px);
  pointer-events: all;
}
```

---

### ISSUE 9: PWA manifest + viewport theme colors still use old dark theme

**File:** `public/manifest.json`

```json
// BEFORE:
{
  "background_color": "#0f172a",
  "theme_color": "#0f172a"
}

// AFTER:
{
  "background_color": "#fbf9f5",
  "theme_color": "#745b00"
}
```

**File:** `src/app/layout.tsx`

```tsx
// BEFORE:
export const viewport: Viewport = {
  themeColor: "#0f172a",
  ...
};

// AFTER:
export const viewport: Viewport = {
  themeColor: "#745b00",
  ...
};
```

---

### ISSUE 10: TopNav — hide balance chip and nav links on mobile (prevent overflow)

**File:** `src/components/common/TopNav.tsx`

The TopNav already hides nav links with `hidden md:flex` which is correct. But verify:

1. The balance chip has `hidden md:flex` — this is correct, keep it
2. The "Trade Now" button takes up space on mobile — make it smaller or hide it:

```tsx
// BEFORE:
<Link
  href="/trade"
  className="bg-primary-container text-on-primary-fixed px-5 py-2 rounded-lg font-bold text-sm hover:brightness-95 active:scale-95 transition-all"
>
  Trade Now
</Link>

// AFTER:
<Link
  href="/trade"
  className="hidden md:inline-flex bg-primary-container text-on-primary-fixed px-5 py-2 rounded-lg font-bold text-sm hover:brightness-95 active:scale-95 transition-all"
>
  Trade Now
</Link>
```

3. The connection indicator dot is fine to keep on all screen sizes.

---

### ISSUE 11: Alerts page — add page heading bar (same as Orders/Trades)

**File:** `src/app/alerts/page.tsx`

```tsx
// BEFORE:
<div className="flex-1 overflow-auto">
  <AlertsPanel />
</div>

// AFTER:
<div className="flex-1 flex flex-col overflow-hidden">
  <div className="page-heading-bar">
    <span className="page-heading-title">Alerts</span>
    <span className="page-heading-meta">Price & event alerts</span>
  </div>
  <div className="flex-1 overflow-auto pb-16 md:pb-0">
    <AlertsPanel />
  </div>
</div>
```

---

### ISSUE 12: Signal Log page — page heading + scrollable content fix

**File:** `src/app/signal-log/page.tsx`

The signal log page already has a custom header inside `p-6`. Wrap the scrollable area:

```tsx
// BEFORE:
<div className="flex-1 overflow-auto p-6">

// AFTER:
<div className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
```

---

### ISSUE 13: Chart page mobile layout — instrument search bar + chart height

**File:** `src/app/trade/page.tsx`

The chart page on mobile should use full height efficiently. The instrument search bar should be touch-friendly.

```tsx
// BEFORE (instrument search bar wrapper):
<div className="flex items-center gap-3 px-3 py-2 border-b border-surface-container-highest shrink-0 bg-surface-container-lowest">
  <div className="flex-1 min-w-0">
    <InstrumentSearch />
  </div>
  {/* CCC button hidden on mobile */}
  <button className="hidden md:flex ...">CCC</button>
</div>

// AFTER: Make the search bar taller/more touch-friendly on mobile:
<div className="flex items-center gap-3 px-3 py-2 md:py-2 border-b border-surface-container-highest shrink-0 bg-surface-container-lowest min-h-[52px] md:min-h-0">
  <div className="flex-1 min-w-0">
    <InstrumentSearch />
  </div>
  {/* CCC button — desktop only */}
  <button className="hidden md:flex ...">CCC</button>
</div>
```

---

### ISSUE 14: Positions page — mobile-friendly layout

**File:** `src/app/positions/page.tsx`

The positions page currently wraps PositionList with no heading. On mobile the list fills full width (good after Issue 2 fix). Add content padding:

```tsx
// BEFORE:
<div className="flex-1 overflow-auto">
  <PositionList />
</div>

// AFTER:
<div className="flex-1 overflow-auto pb-16 md:pb-0">
  <PositionList />
</div>
```

---

## COMPLETE FILE CHANGE SUMMARY

| # | File | Change |
|---|------|--------|
| 1 | `src/components/common/SideNav.tsx` | Add `hidden md:flex` to `<aside>` |
| 2 | `src/app/trade/page.tsx` | `ml-20` → `md:ml-20`; add `<MobileOrderSheet />`; add import |
| 3 | `src/app/positions/page.tsx` | `ml-20` → `md:ml-20`; add `pb-16 md:pb-0` to scroll div |
| 4 | `src/app/orders/page.tsx` | `ml-20` → `md:ml-20`; add `pb-16 md:pb-0` to scroll div |
| 5 | `src/app/trades/page.tsx` | `ml-20` → `md:ml-20`; add `pb-16 md:pb-0` to scroll div |
| 6 | `src/app/watchlist/page.tsx` | `ml-20` → `md:ml-20`; add `pb-16 md:pb-0` to scroll div |
| 7 | `src/app/alerts/page.tsx` | `ml-20` → `md:ml-20`; add page heading bar; add `pb-16 md:pb-0` |
| 8 | `src/app/signal-log/page.tsx` | `ml-20` → `md:ml-20`; add `pb-20 md:pb-6` |
| 9 | `src/app/page.tsx` (dashboard) | `ml-20` → `md:ml-20`; add `pb-20 md:pb-12` to main |
| 10 | `src/components/common/TradingSidebar.tsx` | Add `hidden md:flex` to `<aside>` |
| 11 | `src/components/common/StatusBar.tsx` | Add `hidden md:flex` to `<footer>` |
| 12 | `src/components/common/TopNav.tsx` | Add `hidden md:inline-flex` to "Trade Now" link |
| 13 | `src/components/Chart/TradingChart.tsx` | Update chart colors to WU light theme |
| 14 | `src/app/globals.css` | Update `.mobile-bottom-nav` / `.mobile-nav-tab` to WU light theme; update `.toast-container` for mobile |
| 15 | `public/manifest.json` | Update `background_color` + `theme_color` |
| 16 | `src/app/layout.tsx` | Update `themeColor` in viewport export |
| 17 | **NEW** `src/components/common/MobileOrderSheet.tsx` | Create floating order button + bottom sheet |

---

## IMPLEMENTATION ORDER (do in this sequence)

**Step 1 — Layout foundation (stops the broken 80px margin + hidden sidebars):**
- Fix Issue 1: SideNav `hidden md:flex`
- Fix Issue 2: All pages `ml-20` → `md:ml-20`
- Fix Issue 3: TradingSidebar `hidden md:flex`

**Step 2 — Mobile navigation (makes nav usable):**
- Fix Issue 5: globals.css mobile nav light theme
- Fix Issue 4: StatusBar `hidden md:flex`
- Fix Issue 6: All pages add `pb-16 md:pb-0`

**Step 3 — Mobile order placement (makes trading possible on mobile):**
- Create MobileOrderSheet.tsx (Issue 3, Part B)
- Add MobileOrderSheet to trade/page.tsx

**Step 4 — Visual fixes (chart + theme consistency):**
- Fix Issue 7: TradingChart light theme colors
- Fix Issue 8: Toast container mobile fix
- Fix Issue 9: manifest.json + layout.tsx theme colors
- Fix Issue 10: TopNav "Trade Now" hide on mobile

**Step 5 — Page-level fixes (headings + padding):**
- Fix Issues 11–14: Remaining page-level adjustments

---

## IMPORTANT RULES FOR THE AI MAKING CHANGES

1. **DO NOT modify** any of these (they contain business logic that works correctly):
   - Any `useEffect` hooks
   - Any `fetch` calls or API routes
   - Any Zustand store (`useMarketStore`, `useTradingStore`, `useUIStore`, `useAlertStore`)
   - Socket.IO initialization (`initSocket`, `registerTickPositionUpdater`, `registerServerEventHandler`)
   - The `useCCCEngine` hook
   - Any TypeScript interfaces or types
   - The `ProtectedRoute` component
   - The `PullToRefresh` component (it already works correctly)

2. **Only change:**
   - Tailwind class strings on JSX elements
   - CSS in `src/app/globals.css`
   - `public/manifest.json` color values
   - `src/app/layout.tsx` viewport themeColor
   - The chart options object in `TradingChart.tsx` (colors only)

3. **Preserve all `hidden md:flex` that already exist** (don't remove mobile-hiding classes that are already correct)

4. **Test each step:** After each step, the app should be fully functional on both desktop and mobile without regression.

5. **The MobileOrderSheet** must import `OrderPanel` exactly as: `import { OrderPanel } from '@/components/Trading/OrderPanel';` — no props needed beyond what the component already handles internally.

---

## EXPECTED RESULT AFTER ALL FIXES

**Mobile (< 768px):**
- Full-width pages (no 80px left margin)
- No desktop sidebar eating screen space
- Light cream (#fbf9f5) background throughout
- Mobile bottom nav in white/light theme with gold active state
- Chart in light theme (cream background, subtle grid, gold crosshair)
- "+" floating button on chart page to open order bottom sheet
- Content never hidden behind bottom nav (64px padding at bottom)
- StatusBar hidden (not needed on mobile)
- Toasts appear full-width at top of screen

**Desktop (≥ 768px):**
- All existing desktop functionality preserved
- SideNav shows (80px icon rail, expands on hover)
- TradingSidebar shows (320px Order/Positions panel)
- StatusBar shows at bottom
- No changes to desktop behavior

**PWA:**
- App icon splash screen uses WU light theme (#fbf9f5)
- Browser chrome uses gold accent color (#745b00)
- Standalone mode works correctly
