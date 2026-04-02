"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type UserRole = "ADMIN" | "USER";
type UserStatus = "ACTIVE" | "DISABLED";

type UserPermissions = {
  canPlaceOrder: boolean;
  canExitPosition: boolean;
  canModifySLTarget: boolean;
  canCancelOrder: boolean;
  canViewReports: boolean;
};

type UserRiskLimits = {
  maxOpenPositions: number;
  maxOrderQuantity: number;
  maxDailyLoss: number;
  maxOrderNotional: number;
};

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  role: UserRole;
  status: UserStatus;
  isConfiguredAdmin: boolean;
  permissions: UserPermissions;
  riskLimits: UserRiskLimits;
  _count: {
    accounts: number;
  };
};

type AdminSummary = {
  totalUsers: number;
  adminUsers: number;
  nonAdminUsers: number;
  activeUsers: number;
  disabledUsers: number;
};

type AdminAuditLog = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
};

type UserDraft = {
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  riskLimits: UserRiskLimits;
};

const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
  canPlaceOrder: "Place Order",
  canExitPosition: "Exit Position",
  canModifySLTarget: "Modify SL/Target",
  canCancelOrder: "Cancel Order",
  canViewReports: "View Reports",
};

const RISK_FIELDS: Array<{
  key: keyof UserRiskLimits;
  label: string;
  min: number;
  step: number;
}> = [
  { key: "maxOpenPositions", label: "Max Open Positions", min: 1, step: 1 },
  { key: "maxOrderQuantity", label: "Max Order Quantity", min: 1, step: 1 },
  { key: "maxDailyLoss", label: "Max Daily Loss", min: 1000, step: 1000 },
  { key: "maxOrderNotional", label: "Max Order Notional", min: 10000, step: 10000 },
];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");

  const isAdmin = useMemo(() => session?.user?.role === "ADMIN", [session?.user?.role]);

  const applyPayload = (payload: { users: AdminUser[]; summary: AdminSummary; auditLogs: AdminAuditLog[] }) => {
    const nextUsers = payload.users || [];
    setUsers(nextUsers);
    setSummary(payload.summary || null);
    setAuditLogs(payload.auditLogs || []);
    const nextDrafts: Record<string, UserDraft> = {};
    nextUsers.forEach((u) => {
      nextDrafts[u.id] = {
        role: u.role,
        status: u.status,
        permissions: { ...u.permissions },
        riskLimits: { ...u.riskLimits },
      };
    });
    setDrafts(nextDrafts);
  };

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
        setAuditLogs([]);
      } else {
        applyPayload(data);
      }
    } catch {
      setError("Failed to load users");
      setUsers([]);
      setSummary(null);
      setAuditLogs([]);
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

  const runAction = async (body: Record<string, unknown>, successMessage: string) => {
    setActionLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Admin action failed");
        return false;
      }
      if (data.data?.users && data.data?.summary) {
        applyPayload(data.data);
      } else {
        await loadUsers();
      }
      setMessage(data.message || successMessage);
      return true;
    } catch {
      setError("Admin action failed");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) {
      setError("Name, email and password are required");
      return;
    }
    const ok = await runAction(
      {
        action: "create_user",
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
      },
      "User created"
    );
    if (ok) {
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
    }
  };

  const updateDraft = (userId: string, updater: (draft: UserDraft) => UserDraft) => {
    setDrafts((prev) => {
      const current = prev[userId];
      if (!current) return prev;
      return { ...prev, [userId]: updater(current) };
    });
  };

  const handleSaveUser = async (userId: string) => {
    const draft = drafts[userId];
    if (!draft) return;
    await runAction(
      {
        action: "update_user",
        userId,
        role: draft.role,
        status: draft.status,
        permissions: draft.permissions,
        riskLimits: draft.riskLimits,
      },
      "User access updated"
    );
  };

  const handleResetPassword = async (userId: string) => {
    const newPassword = window.prompt("Enter new password (minimum 6 characters):");
    if (!newPassword) return;
    await runAction(
      {
        action: "reset_password",
        userId,
        newPassword,
      },
      "Password reset successful"
    );
  };

  const handlePurgeNonAdmin = async () => {
    const confirmed = window.confirm(
      "This will delete ALL non-admin users and all their records. Continue?"
    );
    if (!confirmed) return;
    await runAction(
      { action: "purge_non_admin" },
      "Non-admin users removed"
    );
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

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
          <StatCard label="Total Users" value={String(summary.totalUsers)} />
          <StatCard label="Admins" value={String(summary.adminUsers)} />
          <StatCard label="Users" value={String(summary.nonAdminUsers)} />
          <StatCard label="Active" value={String(summary.activeUsers)} />
          <StatCard label="Disabled" value={String(summary.disabledUsers)} />
        </div>
      )}

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Create User</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <input
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="Full name"
            style={inputStyle}
          />
          <input
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            placeholder="Email"
            style={inputStyle}
          />
          <input
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
            placeholder="Password"
            type="password"
            style={inputStyle}
          />
          <button onClick={handleCreateUser} disabled={actionLoading} style={btnPrimary}>
            Create User
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={loadUsers} disabled={actionLoading} style={btnSecondary}>Refresh</button>
        <button onClick={handlePurgeNonAdmin} disabled={actionLoading} style={btnDanger}>
          Remove All Non-Admin Users
        </button>
      </div>

      {message && <div style={{ marginBottom: 12, color: "#38d39f", fontSize: 13 }}>{message}</div>}
      {error && <div style={{ marginBottom: 12, color: "#ff6b6b", fontSize: 13 }}>{error}</div>}

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>User Access Management</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {users.map((u) => {
            const draft = drafts[u.id];
            if (!draft) return null;
            return (
              <div key={u.id} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{u.name || "—"}</div>
                    <div style={{ color: "#9aa0a6", fontSize: 12 }}>{u.email || "—"}</div>
                    <div style={{ color: "#7d8490", fontSize: 11 }}>
                      Created: {new Date(u.createdAt).toLocaleString("en-IN")} · Accounts: {u._count.accounts}
                    </div>
                  </div>
                  {u.isConfiguredAdmin && (
                    <span style={{ alignSelf: "flex-start", fontSize: 11, color: "#ffb74d", border: "1px solid rgba(255,183,77,0.4)", padding: "3px 7px", borderRadius: 999 }}>
                      Configured Admin
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginBottom: 10 }}>
                  <label style={labelStyle}>
                    Role
                    <select
                      value={draft.role}
                      onChange={(e) => updateDraft(u.id, (d) => ({ ...d, role: e.target.value as UserRole }))}
                      disabled={u.isConfiguredAdmin}
                      style={inputStyle}
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Status
                    <select
                      value={draft.status}
                      onChange={(e) => updateDraft(u.id, (d) => ({ ...d, status: e.target.value as UserStatus }))}
                      disabled={u.isConfiguredAdmin}
                      style={inputStyle}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                  </label>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={miniTitle}>Permissions</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 6 }}>
                    {(Object.keys(PERMISSION_LABELS) as Array<keyof UserPermissions>).map((key) => (
                      <label key={key} style={checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={draft.permissions[key]}
                          onChange={(e) =>
                            updateDraft(u.id, (d) => ({
                              ...d,
                              permissions: { ...d.permissions, [key]: e.target.checked },
                            }))
                          }
                        />
                        <span>{PERMISSION_LABELS[key]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={miniTitle}>Risk Limits</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8 }}>
                    {RISK_FIELDS.map((field) => (
                      <label key={field.key} style={labelStyle}>
                        {field.label}
                        <input
                          type="number"
                          min={field.min}
                          step={field.step}
                          value={draft.riskLimits[field.key]}
                          onChange={(e) =>
                            updateDraft(u.id, (d) => ({
                              ...d,
                              riskLimits: {
                                ...d.riskLimits,
                                [field.key]: Number(e.target.value || field.min),
                              },
                            }))
                          }
                          style={inputStyle}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => handleSaveUser(u.id)} disabled={actionLoading} style={btnPrimary}>
                    Save Access
                  </button>
                  <button onClick={() => handleResetPassword(u.id)} disabled={actionLoading} style={btnSecondary}>
                    Reset Password
                  </button>
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <div style={{ color: "#9aa0a6", fontSize: 13 }}>No users found</div>
          )}
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Audit Logs</h3>
        <div style={{ display: "grid", gap: 6 }}>
          {auditLogs.map((log) => (
            <div key={log.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{log.action}</div>
              <div style={{ fontSize: 11, color: "#9aa0a6" }}>
                {new Date(log.createdAt).toLocaleString("en-IN")} · Actor: {log.actorEmail || "unknown"} · Target: {log.targetUserId || "—"}
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div style={{ fontSize: 12, color: "#9aa0a6" }}>No audit logs yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 11, color: "#9aa0a6", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const sectionStyle: CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
};

const sectionTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  margin: "0 0 10px",
};

const miniTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 6,
  color: "#d7dde6",
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  color: "#aeb6c2",
};

const checkboxLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#d7dde6",
};

const inputStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  padding: "8px 10px",
};

const btnBase: CSSProperties = {
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  padding: "8px 12px",
  cursor: "pointer",
  border: "1px solid transparent",
};

const btnPrimary: CSSProperties = {
  ...btnBase,
  background: "rgba(90, 141, 255, 0.2)",
  color: "#9ab4ff",
  borderColor: "rgba(154, 180, 255, 0.45)",
};

const btnSecondary: CSSProperties = {
  ...btnBase,
  background: "rgba(255,255,255,0.08)",
  color: "#d7dde6",
  borderColor: "rgba(255,255,255,0.16)",
};

const btnDanger: CSSProperties = {
  ...btnBase,
  background: "rgba(255, 70, 70, 0.14)",
  color: "#ff8f8f",
  borderColor: "rgba(255, 143, 143, 0.4)",
};
