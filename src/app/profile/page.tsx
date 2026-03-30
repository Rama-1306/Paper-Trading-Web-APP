"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface AccountData {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
  realizedPnl: number;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/account")
        .then((res) => res.json())
        .then((data) => {
          if (data.account) setAccount(data.account);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>Loading profile...</div>
      </div>
    );
  }

  if (!session) return null;

  const balance = account?.balance ?? 1000000;
  const initialBalance = account?.initialBalance ?? 1000000;
  const realizedPnl = account?.realizedPnl ?? 0;
  const totalReturn = ((balance - initialBalance + realizedPnl) / initialBalance) * 100;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>My Profile</h1>
          <Link href="/" style={styles.backLink}>
            &larr; Back to Dashboard
          </Link>
        </div>

        <div style={styles.section}>
          <div style={styles.avatar}>
            {session.user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <h2 style={styles.userName}>{session.user?.name || "Trader"}</h2>
          <p style={styles.userEmail}>{session.user?.email}</p>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Trading Account</h3>
          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>Current Balance</span>
              <span style={styles.statValue}>
                {"\u20B9"}{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>Initial Balance</span>
              <span style={styles.statValue}>
                {"\u20B9"}{initialBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>Realized P&L</span>
              <span style={{
                ...styles.statValue,
                color: realizedPnl >= 0 ? "#00e676" : "#ff1744",
              }}>
                {realizedPnl >= 0 ? "+" : ""}{"\u20B9"}{Math.abs(realizedPnl).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>Total Return</span>
              <span style={{
                ...styles.statValue,
                color: totalReturn >= 0 ? "#00e676" : "#ff1744",
              }}>
                {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            style={styles.logoutButton}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    background: "#0d0f14",
    padding: "20px",
    paddingBottom: "60px",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d0f14",
  },
  loadingText: {
    color: "#666",
    fontSize: "18px",
  },
  card: {
    background: "#1a1d23",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
    padding: "40px",
    width: "100%",
    maxWidth: "500px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
  },
  backLink: {
    color: "#667eea",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 600,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  avatar: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: 700,
    color: "#fff",
  },
  userName: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
  },
  userEmail: {
    fontSize: "14px",
    color: "#888",
    margin: 0,
  },
  divider: {
    height: "1px",
    background: "rgba(255,255,255,0.08)",
    margin: "24px 0",
  },
  sectionTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    marginBottom: "12px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    width: "100%",
  },
  statBox: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: "10px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statLabel: {
    fontSize: "11px",
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  statValue: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#fff",
  },
  logoutButton: {
    background: "rgba(255, 23, 68, 0.15)",
    color: "#ff1744",
    border: "1px solid rgba(255, 23, 68, 0.3)",
    padding: "12px 32px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    marginTop: "8px",
  },
};
