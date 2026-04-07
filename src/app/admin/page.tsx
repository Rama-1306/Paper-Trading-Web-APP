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
  { key: "maxOrderQuantity", label: "Max Order Qty", min: 1, step: 1 },
  { key: "maxDailyLoss", label: "Max Daily Loss", min: 1000, step: 1000 },
  { key: "maxOrderNotional", label: "Max Notional", min: 10000, step: 10000 },
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
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

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
      { action: "create_user", name: newUserName.trim(), email: newUserEmail.trim(), password: newUserPassword },
      "User created"
    );
    if (ok) {
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setShowCreateForm(false);
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
      { action: "update_user", userId, role: draft.role, status: draft.status, permissions: draft.permissions, riskLimits: draft.riskLimits },
      "User access updated"
    );
  };

  const handleResetPassword = async (userId: string) => {
    const newPassword = window.prompt("Enter new password (minimum 6 characters):");
    if (!newPassword) return;
    await runAction({ action: "reset_password", userId, newPassword }, "Password reset successful");
  };

  const handlePurgeNonAdmin = async () => {
    const confirmed = window.confirm("This will delete ALL non-admin users and all their records. Continue?");
    if (!confirmed) return;
    await runAction({ action: "purge_non_admin" }, "Non-admin users removed");
  };

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0d0f14", color: "#9aa0a6" }}>
        Loading...
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
        <p style={{ color: "#9aa0a6" }}>Admin access required.</p>
        <Link href="/" style={{ color: "#7aa2ff" }}>← Back</Link>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", overflowY: "auto", background: "#0d0f14", color: "#fff" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 12px 40px" }}>

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Admin Dashboard</div>
            {summary && (
              <div style={{ fontSize: 11, color: "#9aa0a6", marginTop: 2 }}>
                {summary.totalUsers} users · {summary.activeUsers} active · {summary.disabledUsers} disabled · {summary.adminUsers} admins
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/admin/bots" style={{ color: "#38d39f", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>Bot Monitor →</Link>
            <Link href="/" style={{ color: "#7aa2ff", textDecoration: "none", fontSize: 12 }}>← Back</Link>
          </div>
        </div>

        {/* Alerts */}
        {message && <div style={{ marginBottom: 8, color: "#38d39f", fontSize: 12, padding: "6px 10px", background: "rgba(56,211,159,0.08)", borderRadius: 6 }}>{message}</div>}
        {error && <div style={{ marginBottom: 8, color: "#ff6b6b", fontSize: 12, padding: "6px 10px", background: "rgba(255,107,107,0.08)", borderRadius: 6 }}>{error}</div>}

        {/* Action bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <button onClick={() => setShowCreateForm(v => !v)} style={btnPrimary}>
            {showCreateForm ? "Cancel" : "+ New User"}
          </button>
          <button onClick={loadUsers} disabled={actionLoading} style={btnSecondary}>Refresh</button>
          <button onClick={handlePurgeNonAdmin} disabled={actionLoading} style={btnDanger}>Purge Non-Admin</button>
          <button onClick={() => setShowAuditLogs(v => !v)} style={btnSecondary}>
            {showAuditLogs ? "Hide Audit" : "Audit Logs"}
          </button>
        </div>

        {/* Create user form (collapsible) */}
        {showCreateForm && (
          <div style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={cardTitle}>New User</div>
            <div style={{ display: "grid", gap: 6 }}>
              <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Full name" style={inputStyle} />
              <input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="Email" style={inputStyle} />
              <input value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Password" type="password" style={inputStyle} />
              <button onClick={handleCreateUser} disabled={actionLoading} style={btnPrimary}>Create</button>
            </div>
          </div>
        )}

        {/* User list */}
        <div style={{ display: "grid", gap: 6 }}>
          {users.map((u) => {
            const draft = drafts[u.id];
            if (!draft) return null;
            const isExpanded = expandedUser === u.id;
            const permCount = Object.values(draft.permissions).filter(Boolean).length;
            const totalPerms = Object.keys(draft.permissions).length;

            return (
              <div key={u.id} style={cardStyle}>
                {/* Collapsed row — always visible */}
                <div
                  onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 8 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || "—"}</span>
                      {u.isConfiguredAdmin && (
                        <span style={{ fontSize: 9, color: "#ffb74d", border: "1px solid rgba(255,183,77,0.4)", padding: "1px 5px", borderRadius: 999, flexShrink: 0 }}>Admin</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#9aa0a6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email || "—"}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: draft.status === "ACTIVE" ? "rgba(56,211,159,0.12)" : "rgba(255,107,107,0.12)", color: draft.status === "ACTIVE" ? "#38d39f" : "#ff6b6b" }}>
                      {draft.status}
                    </span>
                    <span style={{ fontSize: 10, color: "#9aa0a6" }}>{permCount}/{totalPerms} perms</span>
                    <span style={{ fontSize: 12, color: "#9aa0a6" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
                    {/* Role & Status */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      <label style={labelStyle}>
                        Role
                        <select value={draft.role} onChange={(e) => updateDraft(u.id, (d) => ({ ...d, role: e.target.value as UserRole }))} disabled={u.isConfiguredAdmin} style={inputStyle}>
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </label>
                      <label style={labelStyle}>
                        Status
                        <select value={draft.status} onChange={(e) => updateDraft(u.id, (d) => ({ ...d, status: e.target.value as UserStatus }))} disabled={u.isConfiguredAdmin} style={inputStyle}>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="DISABLED">DISABLED</option>
                        </select>
                      </label>
                    </div>

                    {/* Permissions as dropdown (multi-select via checkboxes in a styled box) */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={miniTitle}>Permissions</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                        {(Object.keys(PERMISSION_LABELS) as Array<keyof UserPermissions>).map((key) => (
                          <label key={key} style={checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={draft.permissions[key]}
                              onChange={(e) => updateDraft(u.id, (d) => ({ ...d, permissions: { ...d.permissions, [key]: e.target.checked } }))}
                            />
                            <span>{PERMISSION_LABELS[key]}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Risk limits */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={miniTitle}>Risk Limits</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {RISK_FIELDS.map((field) => (
                          <label key={field.key} style={labelStyle}>
                            {field.label}
                            <input
                              type="number"
                              min={field.min}
                              step={field.step}
                              value={draft.riskLimits[field.key]}
                              onChange={(e) => updateDraft(u.id, (d) => ({ ...d, riskLimits: { ...d.riskLimits, [field.key]: Number(e.target.value || field.min) } }))}
                              style={inputStyle}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Meta */}
                    <div style={{ fontSize: 10, color: "#7d8490", marginBottom: 10 }}>
                      Created: {new Date(u.createdAt).toLocaleString("en-IN")} · Accounts: {u._count.accounts}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleSaveUser(u.id)} disabled={actionLoading} style={btnPrimary}>Save</button>
                      <button onClick={() => handleResetPassword(u.id)} disabled={actionLoading} style={btnSecondary}>Reset Password</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {users.length === 0 && <div style={{ color: "#9aa0a6", fontSize: 12 }}>No users found</div>}
        </div>

        {/* Audit logs (collapsible) */}
        {showAuditLogs && (
          <div style={{ ...cardStyle, marginTop: 10 }}>
            <div style={cardTitle}>Audit Logs</div>
            <div style={{ display: "grid", gap: 4 }}>
              {auditLogs.map((log) => (
                <div key={log.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{log.action}</div>
                  <div style={{ fontSize: 10, color: "#9aa0a6" }}>
                    {new Date(log.createdAt).toLocaleString("en-IN")} · {log.actorEmail || "unknown"}
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && <div style={{ fontSize: 11, color: "#9aa0a6" }}>No audit logs yet</div>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: 10,
};

const cardTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
};

const miniTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 5,
  color: "#d7dde6",
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  fontSize: 11,
  color: "#aeb6c2",
};

const checkboxLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  color: "#d7dde6",
  padding: "3px 0",
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
  background: "rgba(90, 141, 255, 0.18)",
  color: "#9ab4ff",
  borderColor: "rgba(154, 180, 255, 0.4)",
};

const btnSecondary: CSSProperties = {
  ...btnBase,
  background: "rgba(255,255,255,0.06)",
  color: "#d7dde6",
  borderColor: "rgba(255,255,255,0.14)",
};

const btnDanger: CSSProperties = {
  ...btnBase,
  background: "rgba(255, 70, 70, 0.12)",
  color: "#ff8f8f",
  borderColor: "rgba(255, 143, 143, 0.35)",
};
