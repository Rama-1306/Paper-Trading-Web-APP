"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  role: "ADMIN" | "USER";
  _count: {
    accounts: number;
  };
};

type AdminSummary = {
  totalUsers: number;
  adminUsers: number;
  nonAdminUsers: number;
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = useMemo(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!adminEmail || !email) return false;
    return adminEmail === email;
  }, [session?.user?.email]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load users");
        setUsers([]);
        setSummary(null);
      } else {
        setUsers(data.users || []);
        setSummary(data.summary || null);
      }
    } catch {
      setError("Failed to load users");
      setUsers([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      loadUsers();
    } else if (status === "authenticated") {
      setLoading(false);
    }
  }, [status, isAdmin]);

  const handlePurgeNonAdmin = async () => {
    const confirmed = window.confirm(
      "This will delete ALL non-admin users and all their accounts/orders/positions/trades/watchlists. Continue?"
    );
    if (!confirmed) return;

    setActionLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purge_non_admin" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Purge failed");
      } else {
        setMessage(
          `Removed ${data.removed?.users ?? 0} users, ${data.removed?.accounts ?? 0} accounts, ${data.removed?.orders ?? 0} orders, ${data.removed?.positions ?? 0} positions, and ${data.removed?.trades ?? 0} trades.`
        );
        await loadUsers();
      }
    } catch {
      setError("Purge failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0d0f14", color: "#9aa0a6" }}>
        Loading admin dashboard...
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0d0f14", color: "#ff6b6b" }}>
        Not authenticated
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#fff", padding: 24 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>Admin Access Required</h1>
        <p style={{ margin: "0 0 16px", color: "#9aa0a6" }}>
          Your account does not have admin permission.
        </p>
        <Link href="/" style={{ color: "#7aa2ff" }}>← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#fff", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Admin Dashboard</h1>
        <Link href="/" style={{ color: "#7aa2ff", textDecoration: "none" }}>← Back to Dashboard</Link>
      </div>

      <p style={{ marginTop: 0, color: "#9aa0a6", fontSize: 13 }}>
        Current role model: configured admin email is ADMIN, all others are USER.
      </p>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
          <Card label="Total Users" value={String(summary.totalUsers)} />
          <Card label="Admin Users" value={String(summary.adminUsers)} />
          <Card label="Non-Admin Users" value={String(summary.nonAdminUsers)} />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={loadUsers}
          disabled={actionLoading}
          style={buttonStyle("secondary")}
        >
          Refresh
        </button>
        <button
          onClick={handlePurgeNonAdmin}
          disabled={actionLoading}
          style={buttonStyle("danger")}
        >
          {actionLoading ? "Purging..." : "Remove All Non-Admin Users"}
        </button>
      </div>

      {message && <div style={{ marginBottom: 12, color: "#38d39f", fontSize: 13 }}>{message}</div>}
      {error && <div style={{ marginBottom: 12, color: "#ff6b6b", fontSize: 13 }}>{error}</div>}

      <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "rgba(255,255,255,0.04)" }}>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Accounts</th>
              <th style={thStyle}>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <td style={tdStyle}>{u.name || "—"}</td>
                <td style={tdStyle}>{u.email || "—"}</td>
                <td style={tdStyle}>{u.role}</td>
                <td style={tdStyle}>{u._count.accounts}</td>
                <td style={tdStyle}>{new Date(u.createdAt).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td style={{ ...tdStyle, textAlign: "center", color: "#9aa0a6" }} colSpan={5}>
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9aa0a6" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#9aa0a6",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const tdStyle: CSSProperties = {
  padding: "10px 12px",
};

function buttonStyle(variant: "secondary" | "danger"): CSSProperties {
  if (variant === "danger") {
    return {
      background: "rgba(255, 70, 70, 0.14)",
      color: "#ff7f7f",
      border: "1px solid rgba(255, 127, 127, 0.4)",
      padding: "8px 12px",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
    };
  }
  return {
    background: "rgba(120, 140, 255, 0.14)",
    color: "#8ea2ff",
    border: "1px solid rgba(142, 162, 255, 0.4)",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}
