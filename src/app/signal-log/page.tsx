"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";

type Signal = {
  id:            string;
  created_at:    string;
  action:        string;
  symbol:        string;
  exchange:      string;
  signal_type:   string;
  score:         number;
  candle_high:   number | null;
  candle_low:    number | null;
  close:         number | null;
  bot_notified:  boolean;
  order_created: boolean;
  order_id:      string | null;
  pnl:           number | null;
};

const REFRESH_INTERVAL_MS = 30_000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day:    "2-digit",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(-8).toUpperCase();
}

export default function SignalLogPage() {
  const [signals, setSignals]     = useState<Signal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef  = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (timerRef.current)  clearInterval(timerRef.current);
      if (countRef.current)  clearInterval(countRef.current);
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchSignals();
    resetCountdown();
    if (timerRef.current)  clearInterval(timerRef.current);
    if (countRef.current)  clearInterval(countRef.current);
    timerRef.current = setInterval(() => { fetchSignals(); resetCountdown(); }, REFRESH_INTERVAL_MS);
    countRef.current = setInterval(() => { setCountdown((c) => (c > 0 ? c - 1 : 0)); }, 1000);
  };

  return (
    <div style={pageWrap}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={header}>
        <div>
          <div style={title}>Signal Flow Log</div>
          <div style={subtitle}>
            TradingView → Bot → Paper Order · full audit trail
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={handleRefresh} style={btnRefresh} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <Link href="/" style={backLink}>← Dashboard</Link>
        </div>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────── */}
      <div style={statusBar}>
        <span style={{ color: "#555a65" }}>
          {lastRefresh
            ? `Last updated: ${lastRefresh.toLocaleTimeString("en-IN", { hour12: false })}`
            : "Loading…"}
        </span>
        <span style={{ color: "#555a65" }}>Auto-refresh in {countdown}s</span>
        <span style={{ color: "#555a65" }}>{signals.length} signals</span>
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
              <th style={th}>Symbol</th>
              <th style={th}>Exch</th>
              <th style={th}>Action</th>
              <th style={th}>Type</th>
              <th style={{ ...th, textAlign: "center" }}>Score</th>
              <th style={th}>Close</th>
              <th style={{ ...th, textAlign: "center" }}>Bot</th>
              <th style={{ ...th, textAlign: "center" }}>Order</th>
              <th style={th}>Order ID</th>
              <th style={{ ...th, textAlign: "right" }}>P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 && !loading && (
              <tr>
                <td colSpan={11} style={{ ...td, textAlign: "center", color: "#555a65", padding: "32px 0" }}>
                  No signals yet. Waiting for TradingView alerts.
                </td>
              </tr>
            )}
            {signals.map((s) => (
              <tr key={s.id} style={trStyle}>
                <td style={{ ...td, color: "#8b8f98", fontSize: 11, whiteSpace: "nowrap" }}>
                  {formatTime(s.created_at)}
                </td>
                <td style={{ ...td, fontWeight: 700, color: "#e8eaed" }}>
                  {s.symbol}
                </td>
                <td style={{ ...td, color: "#8b8f98" }}>
                  {s.exchange}
                </td>
                <td style={td}>
                  <span style={s.action === "BUY" ? tagBuy : tagSell}>
                    {s.action}
                  </span>
                </td>
                <td style={{ ...td, color: "#8b8f98", fontSize: 11 }}>
                  {s.signal_type}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={scoreTag(s.score)}>{s.score}</span>
                </td>
                <td style={{ ...td, color: "#8b8f98", fontSize: 11 }}>
                  {s.close != null ? s.close.toLocaleString("en-IN") : "—"}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={s.bot_notified ? dotGreen : dotGrey} title={s.bot_notified ? "Bot notified" : "Bot not notified"} />
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={s.order_created ? dotGreen : dotGrey} title={s.order_created ? "Order created" : "No order"} />
                </td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#6366f1" }}>
                  {shortId(s.order_id)}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {s.pnl != null ? (
                    <span style={s.pnl >= 0 ? pnlProfit : pnlLoss}>
                      {s.pnl >= 0 ? "+" : ""}
                      {s.pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  ) : (
                    <span style={{ color: "#555a65" }}>—</span>
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
        <span style={{ color: "#555a65" }}>Score 1–4 = confluence strength</span>
        <span style={{ color: "#555a65" }}>Order ID = last 8 chars of paper order</span>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

const pageWrap: CSSProperties = {
  minHeight:  "100vh",
  background: "#0a0e17",
  color:      "#e8eaed",
  fontFamily: "Inter, sans-serif",
  padding:    "16px 12px 40px",
};

const header: CSSProperties = {
  display:        "flex",
  justifyContent: "space-between",
  alignItems:     "flex-start",
  marginBottom:   12,
  flexWrap:       "wrap",
  gap:            8,
};

const title: CSSProperties = {
  fontSize:   18,
  fontWeight: 700,
  color:      "#ffffff",
};

const subtitle: CSSProperties = {
  fontSize:  12,
  color:     "#555a65",
  marginTop: 2,
};

const statusBar: CSSProperties = {
  display:      "flex",
  gap:          16,
  fontSize:     11,
  marginBottom: 10,
  flexWrap:     "wrap",
};

const errorBox: CSSProperties = {
  background:   "rgba(255, 23, 68, 0.08)",
  border:       "1px solid rgba(255, 23, 68, 0.25)",
  borderRadius: 6,
  color:        "#ff6b6b",
  fontSize:     12,
  padding:      "8px 12px",
  marginBottom: 10,
};

const tableWrap: CSSProperties = {
  overflowX:    "auto",
  borderRadius: 10,
  border:       "1px solid rgba(255,255,255,0.06)",
};

const table: CSSProperties = {
  width:          "100%",
  borderCollapse: "collapse",
  fontSize:       12,
};

const th: CSSProperties = {
  padding:         "10px 12px",
  textAlign:       "left",
  color:           "#555a65",
  fontWeight:      600,
  fontSize:        11,
  background:      "#0f1420",
  borderBottom:    "1px solid rgba(255,255,255,0.06)",
  whiteSpace:      "nowrap",
};

const td: CSSProperties = {
  padding:      "9px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
  verticalAlign: "middle",
};

const trStyle: CSSProperties = {
  transition: "background 0.15s",
};

const tagBuy: CSSProperties = {
  background:   "rgba(41, 121, 255, 0.15)",
  color:        "#2979ff",
  border:       "1px solid rgba(41,121,255,0.3)",
  borderRadius: 4,
  padding:      "2px 7px",
  fontSize:     11,
  fontWeight:   700,
};

const tagSell: CSSProperties = {
  background:   "rgba(255, 109, 0, 0.15)",
  color:        "#ff6d00",
  border:       "1px solid rgba(255,109,0,0.3)",
  borderRadius: 4,
  padding:      "2px 7px",
  fontSize:     11,
  fontWeight:   700,
};

function scoreTag(score: number): CSSProperties {
  const colors: Record<number, string> = {
    1: "#555a65",
    2: "#ffab00",
    3: "#ff6d00",
    4: "#00e676",
  };
  return {
    display:      "inline-block",
    width:        20,
    height:       20,
    lineHeight:   "20px",
    textAlign:    "center",
    borderRadius: 4,
    fontSize:     11,
    fontWeight:   700,
    color:        colors[score] ?? "#555a65",
    border:       `1px solid ${colors[score] ?? "#555a65"}40`,
    background:   `${colors[score] ?? "#555a65"}12`,
  };
}

const dotGreen: CSSProperties = {
  display:      "inline-block",
  width:        8,
  height:       8,
  borderRadius: "50%",
  background:   "#00e676",
};

const dotGrey: CSSProperties = {
  display:      "inline-block",
  width:        8,
  height:       8,
  borderRadius: "50%",
  background:   "#2a2f3a",
  border:       "1px solid rgba(255,255,255,0.1)",
};

const pnlProfit: CSSProperties = {
  color:      "#00e676",
  fontWeight: 700,
};

const pnlLoss: CSSProperties = {
  color:      "#ff1744",
  fontWeight: 700,
};

const btnRefresh: CSSProperties = {
  background:   "rgba(99,102,241,0.12)",
  border:       "1px solid rgba(99,102,241,0.3)",
  borderRadius: 6,
  color:        "#818cf8",
  fontSize:     12,
  fontWeight:   700,
  padding:      "6px 14px",
  cursor:       "pointer",
};

const backLink: CSSProperties = {
  color:          "#555a65",
  textDecoration: "none",
  fontSize:       12,
};

const legend: CSSProperties = {
  display:    "flex",
  gap:        16,
  fontSize:   11,
  color:      "#8b8f98",
  marginTop:  12,
  flexWrap:   "wrap",
  alignItems: "center",
};
