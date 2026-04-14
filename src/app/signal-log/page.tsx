"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import { TopNav } from "@/components/common/TopNav";
import { SideNav } from "@/components/common/SideNav";
import { ToastContainer } from "@/components/common/ToastContainer";
import { TradingSidebar } from "@/components/common/TradingSidebar";
import { useMarketStore } from "@/stores/marketStore";
import { useTradingStore } from "@/stores/tradingStore";

type Signal = {
  id: string;
  created_at: string;
  action: string;
  symbol: string;
  exchange: string;
  signal_type: string;
  score: number;
  source: string;
  candle_high: number | null;
  candle_low: number | null;
  close: number | null;
  entry: number | null;
  sl: number | null;
  t1: number | null;
  t2: number | null;
  t3: number | null;
  timeframe: string | null;
  bot_notified: boolean;
  order_created: boolean;
  order_id: string | null;
  pnl: number | null;
};

const REFRESH_INTERVAL_MS = 30_000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(-8).toUpperCase();
}

function fmtPrice(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

export default function SignalLogPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchSignals() {
    try {
      const res = await fetch("/api/webhook/signals", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSignals(data.signals ?? []);
      setLastRefresh(new Date());
      setError(null);
    } catch {
      setError("Could not load signals. Retrying in 30s.");
    } finally {
      setLoading(false);
    }
  }

  function resetCountdown() {
    setCountdown(REFRESH_INTERVAL_MS / 1000);
  }

  useEffect(() => {
    fetchSignals();

    timerRef.current = setInterval(() => {
      fetchSignals();
      resetCountdown();
    }, REFRESH_INTERVAL_MS);

    countRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchSignals();
    resetCountdown();
    if (timerRef.current) clearInterval(timerRef.current);
    if (countRef.current) clearInterval(countRef.current);
    timerRef.current = setInterval(() => { fetchSignals(); resetCountdown(); }, REFRESH_INTERVAL_MS);
    countRef.current = setInterval(() => { setCountdown((c) => (c > 0 ? c - 1 : 0)); }, 1000);
  };

  const initSocket = useMarketStore(s => s.initSocket);
  useEffect(() => {
    useTradingStore.getState().fetchAccount();
    useTradingStore.getState().fetchPositions().then(() => {
      const open = useTradingStore.getState().positions.filter(p => p.isOpen).map(p => p.symbol);
      if (open.length) useMarketStore.getState().subscribePositionSymbols(open);
    });
    useTradingStore.getState().fetchOrders();
    useTradingStore.getState().fetchTrades();
    initSocket();
  }, [initSocket]);

  return (
    <ProtectedRoute>
      <div className="h-screen bg-surface font-sans flex flex-col overflow-hidden">
        <TopNav />
        <div className="flex flex-1 overflow-hidden">
          <SideNav />
          <div className="flex flex-1 md:ml-20 overflow-hidden">
            {/* Main content */}
            <div className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
              {/* Page header */}
              <div className="flex items-start justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-3xl font-black text-on-background tracking-tighter mb-1">Signal Flow Log</h1>
                  <p className="text-sm text-on-surface-variant">CCC Engine + Webhook → Signal Router → Bot → Paper Order</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-on-surface-variant">
                    {lastRefresh
                      ? `Updated ${lastRefresh.toLocaleTimeString("en-IN", { hour12: false })}`
                      : "Loading…"}
                    {" · "}Refresh in {countdown}s
                    {" · "}{signals.length} signals
                  </div>
                  <button onClick={handleRefresh} disabled={loading}
                    className="px-4 py-2 bg-primary-container text-on-primary-fixed text-xs font-bold rounded-lg hover:brightness-95 active:scale-95 transition-all disabled:opacity-50">
                    {loading ? "Loading…" : "Refresh"}
                  </button>
                </div>
              </div>

              {/* ── Source legend ───────────────────────────────────────────── */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={sourceBadge("ccc_engine")}>CCC Engine</span>
                <span style={sourceBadge("webhook")}>Webhook</span>
                <span style={{ color: "#80765f", fontSize: 11, alignSelf: "center" }}>
                  — signal source badges
                </span>
              </div>

              {/* ── Error ──────────────────────────────────────────────────── */}
              {error && (
                <div style={errorBox}>{error}</div>
              )}

              {/* ── Table ──────────────────────────────────────────────────── */}
              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Time</th>
                      <th style={th}>Source</th>
                      <th style={th}>Symbol</th>
                      <th style={th}>TF</th>
                      <th style={th}>Action</th>
                      <th style={th}>Type</th>
                      <th style={{ ...th, textAlign: "center" }}>Score</th>
                      <th style={th}>Entry</th>
                      <th style={th}>SL</th>
                      <th style={th}>T1</th>
                      <th style={{ ...th, textAlign: "center" }}>Bot</th>
                      <th style={{ ...th, textAlign: "center" }}>Order</th>
                      <th style={th}>Order ID</th>
                      <th style={{ ...th, textAlign: "right" }}>P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.length === 0 && !loading && (
                      <tr>
                        <td colSpan={14} style={{ ...td, textAlign: "center", color: "#80765f", padding: "32px 0" }}>
                          No signals yet. Waiting for CCC Engine or TradingView alerts.
                        </td>
                      </tr>
                    )}
                    {signals.map((s) => (
                      <tr key={s.id} style={trStyle}>
                        <td style={{ ...td, color: "#80765f", fontSize: 11, whiteSpace: "nowrap" }}>
                          {formatTime(s.created_at)}
                        </td>
                        <td style={td}>
                          <span style={sourceBadge(s.source)}>{sourceLabel(s.source)}</span>
                        </td>
                        <td style={{ ...td, fontWeight: 700, color: "#1b1c1a" }}>
                          {s.symbol}
                        </td>
                        <td style={{ ...td, color: "#80765f", fontSize: 11 }}>
                          {s.timeframe ? `${s.timeframe}m` : "—"}
                        </td>
                        <td style={td}>
                          <span style={s.action === "BUY" ? tagBuy : tagSell}>
                            {s.action}
                          </span>
                        </td>
                        <td style={{ ...td, color: "#4e4632", fontSize: 11 }}>
                          {s.signal_type}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <span style={scoreTag(s.score)}>{s.score}</span>
                        </td>
                        <td style={{ ...td, color: "#1b1c1a", fontSize: 11 }}>
                          {fmtPrice(s.entry)}
                        </td>
                        <td style={{ ...td, color: "#ba1a1a", fontSize: 11 }}>
                          {fmtPrice(s.sl)}
                        </td>
                        <td style={{ ...td, color: "#00a550", fontSize: 11 }}>
                          {fmtPrice(s.t1)}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <span style={s.bot_notified ? dotGreen : dotGrey} title={s.bot_notified ? "Bot notified" : "Bot not notified"} />
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <span style={s.order_created ? dotGreen : dotGrey} title={s.order_created ? "Order created" : "No order"} />
                        </td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#745b00" }}>
                          {shortId(s.order_id)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {s.pnl != null ? (
                            <span style={s.pnl >= 0 ? pnlProfit : pnlLoss}>
                              {s.pnl >= 0 ? "+" : ""}
                              {s.pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </span>
                          ) : (
                            <span style={{ color: "#80765f" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Legend ─────────────────────────────────────────────────── */}
              <div style={legend}>
                <span><span style={dotGreen} /> = Yes</span>
                <span><span style={dotGrey} />  = No / Pending</span>
                <span style={{ color: "#80765f" }}>Score 1–4 = confluence strength</span>
                <span style={{ color: "#80765f" }}>Order ID = last 8 chars of paper order</span>
              </div>
            </div>
            {/* Right sidebar */}
            <TradingSidebar />
          </div>
        </div>
        <ToastContainer />
      </div>
    </ProtectedRoute>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function sourceLabel(source: string): string {
  if (source === 'ccc_engine') return 'CCC Engine';
  if (source === 'webhook') return 'Webhook';
  return source;
}

function sourceBadge(source: string): CSSProperties {
  if (source === 'ccc_engine') {
    return {
      display: "inline-block", fontSize: 10, fontWeight: 700,
      padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
      background: "rgba(99,102,241,0.15)", color: "#818cf8",
      border: "1px solid rgba(99,102,241,0.35)",
    };
  }
  return {
    display: "inline-block", fontSize: 10, fontWeight: 700,
    padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
    background: "rgba(34,197,94,0.12)", color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.3)",
  };
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

const errorBox: CSSProperties = {
  background: "rgba(186, 26, 26, 0.06)",
  border: "1px solid rgba(186, 26, 26, 0.25)",
  borderRadius: 6,
  color: "#ba1a1a",
  fontSize: 12,
  padding: "8px 12px",
  marginBottom: 10,
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
  borderRadius: 10,
  border: "1px solid #e4e2de",
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const th: CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 10,
  background: "#1b1c1a",
  borderBottom: "1px solid #2a2d35",
  whiteSpace: "nowrap",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const td: CSSProperties = {
  padding: "9px 12px",
  borderBottom: "1px solid #e4e2de",
  verticalAlign: "middle",
  color: "#1b1c1a",
};

const trStyle: CSSProperties = {
  transition: "background 0.15s",
};

const tagBuy: CSSProperties = {
  background: "rgba(41, 121, 255, 0.15)",
  color: "#2979ff",
  border: "1px solid rgba(41,121,255,0.3)",
  borderRadius: 4,
  padding: "2px 7px",
  fontSize: 11,
  fontWeight: 700,
};

const tagSell: CSSProperties = {
  background: "rgba(255, 109, 0, 0.15)",
  color: "#ff6d00",
  border: "1px solid rgba(255,109,0,0.3)",
  borderRadius: 4,
  padding: "2px 7px",
  fontSize: 11,
  fontWeight: 700,
};

function scoreTag(score: number): CSSProperties {
  const colors: Record<number, string> = {
    1: "#555a65", 2: "#ffab00", 3: "#ff6d00", 4: "#00e676",
  };
  return {
    display: "inline-block",
    width: 20,
    height: 20,
    lineHeight: "20px",
    textAlign: "center",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    color: colors[score] ?? "#555a65",
    border: `1px solid ${colors[score] ?? "#555a65"}40`,
    background: `${colors[score] ?? "#555a65"}12`,
  };
}

const dotGreen: CSSProperties = {
  display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#00e676",
};
const dotGrey: CSSProperties = {
  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
  background: "#d2c5ab", border: "1px solid #80765f",
};
const pnlProfit: CSSProperties = { color: "#00e676", fontWeight: 700 };
const pnlLoss: CSSProperties = { color: "#ff1744", fontWeight: 700 };

const legend: CSSProperties = {
  display: "flex",
  gap: 16,
  fontSize: 11,
  color: "#80765f",
  marginTop: 12,
  flexWrap: "wrap",
  alignItems: "center",
};
