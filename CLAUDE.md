# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Important (from AGENTS.md):** This is Next.js 16 — APIs, conventions, and file structure may differ from training data. Read `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Commands

```bash
# Development (Next.js on port 5000)
npm run dev

# WebSocket server (runs separately on port 3002)
npx tsx server/wsServer.ts

# Build (generates Prisma client first)
npm run build

# Lint
npm run lint

# Database migrations
npx prisma migrate dev
npx prisma generate
npx prisma studio        # GUI for inspecting the DB
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` / `DIRECT_URL` — PostgreSQL (Railway in prod)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — NextAuth config
- `FYERS_APP_ID`, `FYERS_APP_SECRET` — Fyers broker API
- `NEXT_PUBLIC_WS_URL` — URL of the WebSocket server (port 3002)

The Fyers access token is stored in `localStorage` under `fyers_access_token` on the client and passed via query param to API routes and via Socket.IO `auth.token` to the WS server. It is **not** stored in the database.

## Architecture

### Two-process design
The app runs as two independent processes:

1. **Next.js app** (`npm run dev`, port 5000) — handles UI, REST API routes, auth, and DB access via Prisma.
2. **WebSocket server** (`server/wsServer.ts`, port 3002) — maintains a persistent Fyers Data Socket connection, streams live ticks to all connected browser clients, and auto-processes SL/target hits and pending limit orders against live prices. It also writes directly to the database (Prisma) to close positions and fill orders.

### State management (Zustand stores in `src/stores/`)
- **`marketStore`** — WebSocket connection lifecycle, live ticks, candlestick data, option chain, active symbol. Bridges tick updates to `tradingStore` via registered callbacks (`registerTickPositionUpdater`, `registerServerEventHandler`).
- **`tradingStore`** — Account summary, positions, orders, trades. Fetches from REST API.
- **`uiStore`** — Toast notifications, modal state.

### API routes (`src/app/api/`)
| Route | Purpose |
|---|---|
| `auth/[...nextauth]` | NextAuth (credentials + OAuth) |
| `auth/register` | User registration |
| `auth/fyers` / `auth/callback` | Fyers OAuth flow |
| `account` | Account balance & summary |
| `orders` | Place, list, cancel orders |
| `positions` | Open/closed positions, close by ID |
| `trades` | Trade history |
| `history` | Fyers historical candles proxy |
| `option-chain` | Fyers option chain proxy |
| `symbol-search` | Symbol lookup |
| `margin` | Margin calculation |
| `watchlists` | CRUD for watchlists |

### Broker integration (`src/lib/broker/fyers.ts`)
`FyersAPI` class wraps the Fyers REST API v3. Requires `FYERS_APP_ID` and `FYERS_SECRET_KEY` env vars. The login flow: redirect to Fyers → receive `auth_code` → exchange for `access_token` via `validateAuthCode()` → store token in `localStorage`.

### Data model (PostgreSQL via Prisma)
`User → Account → Position / Order / Trade`. A user can have multiple accounts. Positions track SL/target/trailing-SL fields; when hit, the WS server closes the position server-side and emits `position_closed` / `order_filled` / `sl_updated` Socket.IO events to trigger client-side refreshes.

### Key lib utilities
- `src/lib/utils/symbols.ts` — symbol formatting, current futures symbol calculation
- `src/lib/utils/margins.ts` — margin calculation per instrument type
- `src/lib/utils/formatters.ts` — currency/number formatters
- `src/lib/utils/constants.ts` — lot sizes, margin requirements per underlying
- `src/lib/indicators/ccc.ts` — custom indicator logic
