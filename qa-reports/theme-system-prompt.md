# Theme System Implementation — Prompt for Minimax

## Goal
Add a **theme switcher** to the SAHAAI Paper Trading web app / PWA that lets users choose between:
1. **WU Light** (current default — do not change its look)
2. **WU Dark**
3. Optional color variants: **Ocean Blue**, **Forest Green**, **Royal Purple** (same structure, different accent hue only)

The current WU Precision Ledger design language (typography, spacing, component structure, layout) **must remain identical**. You are only changing **colors**, not the visual design.

---

## CRITICAL — DO NOT TOUCH THESE FILES / AREAS

Previous AI attempts broke the live feed and business logic by editing files outside the CSS/theme scope. **You must not modify anything in these paths:**

- `server/**` (WebSocket server, Fyers integration)
- `src/stores/**` (Zustand stores — marketStore, tradingStore, uiStore, alertStore)
- `src/hooks/**`
- `src/lib/broker/**`, `src/lib/indicators/**`, `src/lib/utils/**` (except if adding a `src/lib/theme/` folder)
- `src/app/api/**` (all API routes)
- `prisma/**`
- Any file containing `useEffect`, `useState`, `socket.io`, `fetch(`, `useMarketStore`, `useTradingStore` — **do not add, remove, or modify any of these hooks or calls**. If you need to read the theme in a component, use a dedicated theme hook described later in this doc.
- Any `WebSocket`, `Socket.IO`, or `Fyers` related logic

**You must not edit any `useEffect` dependency array.**
**You must not remove or rewrite any existing function.**
**You must not change any imports that aren't purely CSS/type related.**

If you believe an exception is needed for any of the above, **stop and ask first**.

---

## What you ARE allowed to modify

| File / path | Allowed change |
|---|---|
| `src/app/globals.css` | Add theme variables, add `[data-theme="..."]` blocks |
| `tailwind.config.ts` / `.js` | Map Tailwind colors to CSS variables (no value changes, just `var(...)` references) |
| `src/components/**/*.tsx` | Replace **hardcoded hex colors only** with `var(--token-name)` or Tailwind token classes. Do not change JSX structure, logic, or hooks. |
| `src/app/layout.tsx` | Add a **single** inline `<script>` in `<head>` to apply the saved theme before hydration (to prevent flash) |
| **New files** you may create: | |
| `src/components/common/ThemeSwitcher.tsx` | Dropdown UI |
| `src/hooks/useTheme.ts` | Hook that reads/writes `localStorage['wu-theme']` and sets `document.documentElement.dataset.theme` |
| `src/lib/theme/themes.ts` | Theme metadata (id, label, preview colors) |

---

## Implementation plan — 5 phases, one PR per phase

Run each phase as a **separate branch + PR + preview deploy**. Do not start phase N+1 until phase N is merged and the live feed / chart / order placement are verified working on the Railway preview.

### Phase 0 — Branch setup (read-only)

1. Base branch: `main` at commit `c21f1f4` (or latest `main`).
2. Create working branch: `feat/theme-system`.
3. Each phase below is a sub-branch off `feat/theme-system` merged back into it.

### Phase 1 — Token extraction (NO visual change)

**Goal:** Replace every hardcoded color in the codebase with a CSS variable. The app must look **pixel-identical** after this phase. No dark mode yet.

**Steps:**

1. In `src/app/globals.css`, under `:root`, define the complete semantic token set. Each token maps to the **existing** WU Light color so the UI does not change:

   ```css
   :root {
     /* Backgrounds */
     --wu-bg-base: #fbf9f5;
     --wu-bg-surface: #ffffff;
     --wu-bg-surface-raised: #f5f3ef;
     --wu-bg-surface-sunken: #f0ede6;
     --wu-bg-inverse: #1b1c1a;          /* e.g. data-table th */

     /* Borders & dividers */
     --wu-border-subtle: #e4e2de;
     --wu-border-strong: #80765f;

     /* Text */
     --wu-text-primary: #1b1c1a;
     --wu-text-secondary: #4e4632;
     --wu-text-muted: #80765f;
     --wu-text-inverse: #ffffff;        /* on dark surfaces */

     /* Brand / accent */
     --wu-accent: #745b00;
     --wu-accent-hover: #8a6d00;
     --wu-accent-fg: #ffffff;
     --wu-accent-container: #ffcc00;
     --wu-accent-container-fg: #1b1c1a;

     /* Semantic */
     --wu-profit: #00875a;
     --wu-loss:   #ba1a1a;
     --wu-buy:    #4da6ff;
     --wu-sell:   #ff9800;
     --wu-warning: #d47a00;

     /* Chart */
     --wu-chart-grid: #e4e2de;
     --wu-chart-candle-up: #00875a;
     --wu-chart-candle-down: #ba1a1a;
     --wu-chart-volume-up: rgba(0,135,90,0.35);
     --wu-chart-volume-down: rgba(186,26,26,0.35);
   }
   ```

2. **Search the entire `src/` tree** for hardcoded hex colors and `rgba(...)` values in `.tsx`, `.ts`, and `.css` files. For each, replace the hex with the matching `var(--wu-...)` token. Map by semantic meaning:
   - `#fbf9f5`, `#ffffff` on page background → `var(--wu-bg-base)` / `var(--wu-bg-surface)`
   - `#f5f3ef` → `var(--wu-bg-surface-raised)`
   - `#e4e2de` → `var(--wu-border-subtle)`
   - `#1b1c1a` (text) → `var(--wu-text-primary)`
   - `#1b1c1a` (background, e.g. table header) → `var(--wu-bg-inverse)`
   - `#80765f` → `var(--wu-text-muted)`
   - `#745b00` → `var(--wu-accent)`
   - `#00875a` (green text) → `var(--wu-profit)`
   - `#ba1a1a` (red text) → `var(--wu-loss)`
   - `#4da6ff` → `var(--wu-buy)`
   - `#ff9800` → `var(--wu-sell)`

3. Tailwind classes referring to hardcoded values (`bg-[#fbf9f5]`, etc.): convert to token-based classes. In `tailwind.config`, add:
   ```ts
   colors: {
     'wu-bg': 'var(--wu-bg-base)',
     'wu-surface': 'var(--wu-bg-surface)',
     'wu-text': 'var(--wu-text-primary)',
     'wu-muted': 'var(--wu-text-muted)',
     'wu-accent': 'var(--wu-accent)',
     'wu-profit': 'var(--wu-profit)',
     'wu-loss': 'var(--wu-loss)',
     // ...etc for every token
   }
   ```

4. **Do NOT remove or change** the existing Tailwind color palette (`bg-surface`, `text-on-background`, etc.) used throughout the codebase. Those must keep working. Only add new tokens; modify the **values** only.

5. **Acceptance test** before PR merge:
   - `npx tsc --noEmit` passes.
   - `npm run build` passes.
   - Open every page on preview deploy (`/`, `/trade`, `/positions`, `/orders`, `/trades`, `/watchlist`, `/option-chain`, `/alerts`, `/profile`).
   - Live feed green dot works.
   - Chart updates in real time.
   - Place a test paper order → fills correctly.
   - Visual diff against pre-PR: **must be indistinguishable**.

### Phase 2 — Add Dark theme (no UI switcher yet)

**Goal:** Add a `[data-theme="dark"]` CSS block that redefines every token for dark mode. Test by manually setting `document.documentElement.dataset.theme = "dark"` in DevTools.

Add at the bottom of `globals.css`:

```css
[data-theme="dark"] {
  --wu-bg-base: #0f0e0c;
  --wu-bg-surface: #1a1816;
  --wu-bg-surface-raised: #252220;
  --wu-bg-surface-sunken: #0a0908;
  --wu-bg-inverse: #fbf9f5;

  --wu-border-subtle: #2e2a26;
  --wu-border-strong: #6b6459;

  --wu-text-primary: #f0ede6;
  --wu-text-secondary: #c5bfb3;
  --wu-text-muted: #8a8273;
  --wu-text-inverse: #1b1c1a;

  --wu-accent: #ffcc00;
  --wu-accent-hover: #ffd733;
  --wu-accent-fg: #1b1c1a;
  --wu-accent-container: #745b00;
  --wu-accent-container-fg: #ffffff;

  --wu-profit: #22c55e;
  --wu-loss:   #ef4444;
  --wu-buy:    #60a5fa;
  --wu-sell:   #fb923c;

  --wu-chart-grid: #2e2a26;
  --wu-chart-candle-up: #22c55e;
  --wu-chart-candle-down: #ef4444;
  --wu-chart-volume-up: rgba(34,197,94,0.35);
  --wu-chart-volume-down: rgba(239,68,68,0.35);
}
```

**Acceptance test:** in DevTools, run `document.documentElement.dataset.theme = "dark"` — every page must render in dark mode with no white flashes, broken contrast, or missing elements. `delete document.documentElement.dataset.theme` must restore light theme perfectly.

### Phase 3 — Color variants (optional, can defer)

Add additional `[data-theme="..."]` blocks. Each one overrides **only accent-related tokens**:

```css
[data-theme="ocean"] {
  --wu-accent: #0284c7;
  --wu-accent-hover: #0369a1;
  --wu-accent-container: #7dd3fc;
}
[data-theme="forest"] {
  --wu-accent: #15803d;
  --wu-accent-hover: #166534;
  --wu-accent-container: #86efac;
}
[data-theme="purple"] {
  --wu-accent: #7c3aed;
  --wu-accent-hover: #6d28d9;
  --wu-accent-container: #c4b5fd;
}
```

Pair each with a dark equivalent: `[data-theme="ocean-dark"]`, etc.

### Phase 4 — Theme hook & storage

Create `src/hooks/useTheme.ts`:

```ts
'use client';
import { useEffect, useState } from 'react';

export type ThemeId = 'light' | 'dark' | 'ocean' | 'ocean-dark' | 'forest' | 'forest-dark' | 'purple' | 'purple-dark';

const THEME_KEY = 'wu-theme';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>('light');

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_KEY) as ThemeId) || 'light';
    setThemeState(saved);
    applyTheme(saved);
  }, []);

  const setTheme = (next: ThemeId) => {
    localStorage.setItem(THEME_KEY, next);
    setThemeState(next);
    applyTheme(next);
  };

  return { theme, setTheme };
}

function applyTheme(id: ThemeId) {
  if (id === 'light') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = id;
  }
}
```

**Prevent flash-of-unstyled-theme on reload:** in `src/app/layout.tsx`, inside `<html>` but before `<body>`, add:

```tsx
<head>
  <script dangerouslySetInnerHTML={{ __html: `
    try {
      var t = localStorage.getItem('wu-theme');
      if (t && t !== 'light') document.documentElement.dataset.theme = t;
    } catch(e) {}
  ` }} />
</head>
```

This is the **only** change allowed to `layout.tsx`. Do not touch the metadata, viewport, fonts, or Providers wrapping.

### Phase 5 — Theme switcher UI

Create `src/components/common/ThemeSwitcher.tsx` — a small dropdown that:
- Reads `useTheme()` state.
- Shows a grid of theme preview swatches (8 themes = 4 × 2).
- On click: calls `setTheme(id)`.

Place it in **one** of:
- `TopNav.tsx` next to the avatar (desktop)
- `ProfilePage` under a "Preferences" section

**Do not add it to every page.** The theme is global — one switcher is enough.

Example structure (keep simple, no new state management):

```tsx
'use client';
import { useTheme, ThemeId } from '@/hooks/useTheme';
import { useState } from 'react';

const THEMES: { id: ThemeId; label: string; preview: string }[] = [
  { id: 'light',        label: 'WU Light',   preview: '#fbf9f5' },
  { id: 'dark',         label: 'WU Dark',    preview: '#1a1816' },
  { id: 'ocean',        label: 'Ocean',      preview: '#0284c7' },
  { id: 'ocean-dark',   label: 'Ocean Dark', preview: '#0c4a6e' },
  // ... etc
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  // render dropdown, onClick setTheme + setOpen(false)
}
```

---

## Testing checklist (run after EVERY phase)

Mark each box. If any fails, roll back the PR and investigate.

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npm run build` passes
- [ ] Preview deploy loads on Railway
- [ ] `/` (Portfolio) renders with correct colors and all widgets visible
- [ ] `/trade` chart appears and **live price ticks update** (green dot on + numbers changing)
- [ ] Place a test paper BUY order on BANKNIFTY FUT → fills → appears in `/positions`
- [ ] `/positions` lists the position with live LTP updating
- [ ] `/orders`, `/trades`, `/watchlist`, `/option-chain`, `/alerts` all render
- [ ] Mobile view (DevTools → iPhone preset): bottom nav works, MobileOrderSheet opens and "Place Order" button is reachable
- [ ] No console errors (red messages) on any page
- [ ] **Diff against the previous phase:** only expected visual changes, nothing else

**If the live feed stops working after your change, that is the signal that you touched something outside the allowed scope. Revert immediately and re-read the "DO NOT TOUCH" section above.**

---

## Commit message format

```
theme(phase-N): <short description>

- what changed (files/areas)
- what did NOT change (confirm out-of-scope safe)

Phase N of 5 — theme system
```

---

## Deliverables

- `feat/theme-system` branch with phases 1-5 merged sequentially
- Each phase = one PR with passing CI and preview deploy screenshot
- Short `THEME.md` added to repo root describing how to add a new theme
- Final PR into `main` after owner (Rama) signs off
