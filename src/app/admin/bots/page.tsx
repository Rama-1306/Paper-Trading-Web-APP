"use client";

/**
 * /admin/bots
 * SAHAAI Admin — Bot Monitor Dashboard (Phase 2C, Step 12)
 *
 * Shows all registered bots with:
 *   - Live status (Online / Halted / Offline)
 *   - Mode (Paper / Shadow / Live)
 *   - Last ping time, uptime, today's trades and P&L
 *   - Kill switch and Resume buttons per bot
 *   - Manual signal form to broadcast to all active bots
 *
 * Auto-refreshes every 30 seconds.
 */

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type BotStatus = {
  id: number;
  user_id: string;
  bot_url: string;
  status: string;
  mode: string;
  uptime_minutes: number;
  daily_trades: number;
  daily_pnl: number;
  open_positions: number;
  last_trade_time: string | null;
  last_ping: string;
  created_at: string;
  is_online: boolean;
};

type SignalForm = {
  action: "BUY" | "SELL";
  symbol: string;
  signal_type: string;
  score: number;
  trigger_high: string;
  trigger_low: string;
};

const INITIAL_SIGNAL: SignalForm = {
  action: "BUY",
  symbol: "",
  signal_type: "CCC_BULL",
  score: 4,
  trigger_high: "",
  trigger_low: "",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatUptime(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function pnlColor(pnl: number): string {
  if (pnl > 0) return "#38d39f";
  if (pnl < 0) return "#ff6b6b";
  return "#9aa0a6";
}

function shortId(user_id: string): string {
  // Show last 8 chars of license key for readability
  return user_id.length > 8 ? "…" + user_id.slice(-8) : user_id;
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ bot }: { bot: BotStatus }) {
  const label = !bot.is_online ? "Offline" : bot.status === "halted" ? "Halted" : "Online";
  const color = !bot.is_online ? "#9aa0a6" : bot.status === "halted" ? "#ffb74d" : "#38d39f";
  const bg    = !bot.is_online ? "rgba(154,160,166,0.12)" : bot.status === "halted" ? "rgba(255,183,77,0.12)" : "rgba(56,211,159,0.12)";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color, letterSpacing: 0.3 }}>
      {label}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const m = mode.toLowerCase();
  const color = m === "live" ? "#ff6b6b" : m === "shadow" ? "#ffb74d" : "#7aa2ff";
  const bg    = m === "live" ? "rgba(255,107,107,0.12)" : m === "shadow" ? "rgba(255,183,77,0.12)" : "rgba(122,162,255,0.12)";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color, letterSpacing: 0.3 }}>
      {mode.toUpperCase()}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BotMonitorPage() {
  const { data: session, status } = useSession();
  const [bots, setBots] = useState<BotStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSignalForm, setShowSignalForm] = useState(false);
  const [signal, setSignal] = useState<SignalForm>(INITIAL_SIGNAL);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";

  const loadBots = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bots", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setBots(data.bots ?? []);
        setError(null);
      } else {
        setError(data.error ?? "Failed to load bot statuses");
      }
    } catch {
      setError("Failed to reach server");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 30 seconds
  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      loadBots();
      refreshTimer.current = setInterval(loadBots, 30_000);
    } else if (status === "authenticated") {
      setLoading(false);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [status, isAdmin, loadBots]);

  const postAction = async (body: Record<string, unknown>, successMsg: string) => {
    setActionLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message ?? successMsg);
        await loadBots();
      } else {
        setError(data.error ?? "Action failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleKill   = (user_id: string) => postAction({ action: "kill",   user_id }, "Kill switch activated");
  const handleResume = (user_id: string) => postAction({ action: "resume", user_id }, "Trading resumed");

  const handleBroadcast = async () => {
    if (!signal.symbol.trim()) {
      setError("Symbol is required");
      return;
    }
    const payload: Record<string, unknown> = {
      action:      signal.action,
      symbol:      signal.symbol.trim().toUpperCase(),
      signal_type: signal.signal_type,
      score:       signal.score,
      timestamp:   new Date().toISOString(),
    };
    if (signal.trigger_high) payload.trigger_high = parseFloat(signal.trigger_high);
    if (signal.trigger_low)  payload.trigger_low  = parseFloat(signal.trigger_low);

    await postAction({ action: "signal", signal: payload }, "Signal broadcast sent");
    setShowSignalForm(false);
    setSignal(INITIAL_SIGNAL);
  };

  // ── Guard states ────────────────────────────────────────────────────────────

  if (status === "loading" || loading) {
    return <div style={centerStyle}>Loading...</div>;
  }
  if (!session) {
    return <div style={centerStyle}>Not authenticated</div>;
  }
  if (!isAdmin) {
    return (
      <div style={{ ...centerStyle, flexDirection: "column", gap: 12 }}>
        <div style={{ color: "#ff6b6b" }}>Admin access required</div>
        <Link href="/" style={{ color: "#7aa2ff", fontSize: 13 }}>← Back</Link>
      </div>
    );
  }

  const onlineCount  = bots.filter((b) => b.is_online && b.status !== "halted").length;
  const haltedCount  = bots.filter((b) => b.status === "halted").length;
  const offlineCount = bots.filter((b) => !b.is_online).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#fff", overflowY: "auto" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "16px 12px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Bot Monitor</div>
            <div style={{ fontSize: 11, color: "#9aa0a6", marginTop: 3 }}>
              {bots.length} bots registered &nbsp;·&nbsp;
              <span style={{ color: "#38d39f" }}>{onlineCount} online</span>
              {haltedCount > 0 && <span style={{ color: "#ffb74d" }}> · {haltedCount} halted</span>}
              {offlineCount > 0 && <span style={{ color: "#9aa0a6" }}> · {offlineCount} offline</span>}
              &nbsp;·&nbsp; auto-refresh 30s
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/admin" style={{ color: "#7aa2ff", textDecoration: "none", fontSize: 12 }}>← Admin</Link>
          </div>
        </div>

        {/* Alerts */}
        {message && (
          <div style={{ marginBottom: 8, color: "#38d39f", fontSize: 12, padding: "6px 10px", background: "rgba(56,211,159,0.08)", borderRadius: 6 }}>
            {message}
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 8, color: "#ff6b6b", fontSize: 12, padding: "6px 10px", background: "rgba(255,107,107,0.08)", borderRadius: 6 }}>
            {error}
          </div>
        )}

        {/* Action bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <button onClick={loadBots} disabled={actionLoading} style={btnSecondary}>
            Refresh
          </button>
          <button onClick={() => setShowSignalForm((v) => !v)} style={btnPrimary}>
            {showSignalForm ? "Cancel Signal" : "Send Manual Signal"}
          </button>
        </div>

        {/* Manual Signal Form */}
        {showSignalForm && (
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <div style={cardTitle}>Manual Signal — broadcast to all online bots</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <label style={labelStyle}>
                Action
                <select value={signal.action} onChange={(e) => setSignal((s) => ({ ...s, action: e.target.value as "BUY" | "SELL" }))} style={inputStyle}>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </label>
              <label style={labelStyle}>
                Signal Type
                <select value={signal.signal_type} onChange={(e) => setSignal((s) => ({ ...s, signal_type: e.target.value }))} style={inputStyle}>
                  <option value="CCC_BULL">CCC_BULL</option>
                  <option value="CCC_BEAR">CCC_BEAR</option>
                  <option value="GANN_BUY">GANN_BUY</option>
                  <option value="GANN_SELL">GANN_SELL</option>
                  <option value="MANUAL">MANUAL</option>
                </select>
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Symbol (e.g. BANKNIFTY25JAN48000CE)
                <input
                  value={signal.symbol}
                  onChange={(e) => setSignal((s) => ({ ...s, symbol: e.target.value }))}
                  placeholder="BANKNIFTY25JAN48000CE"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Score (1–4)
                <input type="number" min={1} max={4} value={signal.score} onChange={(e) => setSignal((s) => ({ ...s, score: Number(e.target.value) }))} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Trigger High (optional)
                <input type="number" value={signal.trigger_high} onChange={(e) => setSignal((s) => ({ ...s, trigger_high: e.target.value }))} placeholder="e.g. 210.5" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Trigger Low (optional)
                <input type="number" value={signal.trigger_low} onChange={(e) => setSignal((s) => ({ ...s, trigger_low: e.target.value }))} placeholder="e.g. 190.0" style={inputStyle} />
              </label>
            </div>
            <button onClick={handleBroadcast} disabled={actionLoading} style={btnPrimary}>
              Broadcast Signal
            </button>
          </div>
        )}

        {/* Bot list */}
        {bots.length === 0 ? (
          <div style={{ color: "#9aa0a6", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
            No bots registered yet. Bots appear here once they start and send their first heartbeat.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {bots.map((bot) => (
              <div key={bot.id} style={cardStyle}>
                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{shortId(bot.user_id)}</span>
                      <StatusBadge bot={bot} />
                      <ModeBadge mode={bot.mode} />
                    </div>
                    <div style={{ fontSize: 10, color: "#9aa0a6" }}>
                      Last ping: <span style={{ color: "#d7dde6" }}>{relativeTime(bot.last_ping)}</span>
                      {bot.uptime_minutes > 0 && (
                        <> &nbsp;·&nbsp; Uptime: <span style={{ color: "#d7dde6" }}>{formatUptime(bot.uptime_minutes)}</span></>
                      )}
                    </div>
                    {bot.bot_url && (
                      <div style={{ fontSize: 9, color: "#7d8490", marginTop: 2, wordBreak: "break-all" }}>{bot.bot_url}</div>
                    )}
                  </div>

                  {/* Kill / Resume buttons */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "flex-start" }}>
                    {bot.status !== "halted" ? (
                      <button
                        onClick={() => { if (window.confirm(`Kill switch for ${shortId(bot.user_id)}? This will halt all their trading immediately.`)) handleKill(bot.user_id); }}
                        disabled={actionLoading}
                        style={btnDanger}
                        title="Halt all trading on this bot"
                      >
                        Kill
                      </button>
                    ) : (
                      <button
                        onClick={() => handleResume(bot.user_id)}
                        disabled={actionLoading}
                        style={btnResume}
                        title="Re-enable trading on this bot"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
                  <div style={statCell}>
                    <div style={statLabel}>Today Trades</div>
                    <div style={statValue}>{bot.daily_trades}</div>
                  </div>
                  <div style={statCell}>
                    <div style={statLabel}>Today P&amp;L</div>
                    <div style={{ ...statValue, color: pnlColor(bot.daily_pnl) }}>
                      {bot.daily_pnl >= 0 ? "+" : ""}₹{bot.daily_pnl.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div style={statCell}>
                    <div style={statLabel}>Open Positions</div>
                    <div style={statValue}>{bot.open_positions}</div>
                  </div>
                </div>

                {/* Last trade time */}
                {bot.last_trade_time && (
                  <div style={{ fontSize: 10, color: "#7d8490", marginTop: 6 }}>
                    Last trade: {new Date(bot.last_trade_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const centerStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0d0f14",
  color: "#9aa0a6",
};

const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: 12,
};

const cardTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 10,
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  fontSize: 11,
  color: "#aeb6c2",
};

const inputStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 6,
  color: "#fff",
  fontSize: 11,
  padding: "6px 8px",
};

const btnBase: CSSProperties = {
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
  padding: "6px 10px",
  cursor: "pointer",
  border: "1px solid transparent",
};

const btnPrimary: CSSProperties = {
  ...btnBase,
  background: "rgba(90,141,255,0.18)",
  color: "#9ab4ff",
  borderColor: "rgba(154,180,255,0.4)",
};

const btnSecondary: CSSProperties = {
  ...btnBase,
  background: "rgba(255,255,255,0.06)",
  color: "#d7dde6",
  borderColor: "rgba(255,255,255,0.14)",
};

const btnDanger: CSSProperties = {
  ...btnBase,
  background: "rgba(255,70,70,0.12)",
  color: "#ff8f8f",
  borderColor: "rgba(255,143,143,0.35)",
};

const btnResume: CSSProperties = {
  ...btnBase,
  background: "rgba(56,211,159,0.12)",
  color: "#38d39f",
  borderColor: "rgba(56,211,159,0.35)",
};

const statCell: CSSProperties = {
  textAlign: "center",
};

const statLabel: CSSProperties = {
  fontSize: 9,
  color: "#7d8490",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 2,
};

const statValue: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#d7dde6",
};
