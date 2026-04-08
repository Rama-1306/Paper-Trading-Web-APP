-- Migration: Add dual signal input fields + order intent
-- Run with: npx prisma db execute --file prisma/migrations/add_signal_fields.sql

-- Add new columns to webhook_signals
ALTER TABLE webhook_signals
  ADD COLUMN IF NOT EXISTS entry     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS sl        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS t1        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS t2        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS t3        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS timeframe TEXT;

-- Update existing rows: rename old source value 'tradingview' → 'webhook'
UPDATE webhook_signals SET source = 'webhook' WHERE source = 'tradingview';

-- Create signal_settings table (singleton row id=1)
CREATE TABLE IF NOT EXISTS signal_settings (
  id                   INTEGER  PRIMARY KEY DEFAULT 1,
  ccc_engine_enabled   BOOLEAN  NOT NULL DEFAULT TRUE,
  webhook_enabled      BOOLEAN  NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default row if missing
INSERT INTO signal_settings (id, ccc_engine_enabled, webhook_enabled, updated_at)
VALUES (1, TRUE, TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Add intent column to orders (OPEN = new position, CLOSE = exit existing)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'OPEN';
