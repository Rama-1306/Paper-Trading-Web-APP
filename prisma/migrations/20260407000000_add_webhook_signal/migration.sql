-- CreateTable: webhook_signals (WebhookSignal model)
CREATE TABLE IF NOT EXISTS "webhook_signals" (
    "id"            TEXT NOT NULL,
    "action"        TEXT NOT NULL,
    "symbol"        TEXT NOT NULL,
    "exchange"      TEXT NOT NULL DEFAULT 'NSE',
    "signal_type"   TEXT NOT NULL,
    "score"         INTEGER NOT NULL,
    "candle_high"   DOUBLE PRECISION,
    "candle_low"    DOUBLE PRECISION,
    "close"         DOUBLE PRECISION,
    "source"        TEXT NOT NULL DEFAULT 'tradingview',
    "bot_notified"  BOOLEAN NOT NULL DEFAULT false,
    "order_created" BOOLEAN NOT NULL DEFAULT false,
    "order_id"      TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bot_status (BotStatus model)
CREATE TABLE IF NOT EXISTS "bot_status" (
    "id"              SERIAL NOT NULL,
    "user_id"         TEXT NOT NULL,
    "bot_url"         TEXT NOT NULL DEFAULT '',
    "status"          TEXT NOT NULL DEFAULT 'offline',
    "mode"            TEXT NOT NULL DEFAULT 'paper',
    "uptime_minutes"  INTEGER NOT NULL DEFAULT 0,
    "daily_trades"    INTEGER NOT NULL DEFAULT 0,
    "daily_pnl"       DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "open_positions"  INTEGER NOT NULL DEFAULT 0,
    "last_trade_time" TIMESTAMP(3),
    "last_ping"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique user_id in bot_status
CREATE UNIQUE INDEX IF NOT EXISTS "bot_status_user_id_key" ON "bot_status"("user_id");
