import prisma from '@/lib/db';
import { isAdminEmail } from '@/lib/admin';

export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface UserPermissions {
  canPlaceOrder: boolean;
  canExitPosition: boolean;
  canModifySLTarget: boolean;
  canCancelOrder: boolean;
  canViewReports: boolean;
}

export interface UserRiskLimits {
  maxOpenPositions: number;
  maxOrderQuantity: number;
  maxDailyLoss: number;
  maxOrderNotional: number;
}

export interface UserAccessProfile {
  userId: string;
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  riskLimits: UserRiskLimits;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminAuditLog {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  canPlaceOrder: true,
  canExitPosition: true,
  canModifySLTarget: true,
  canCancelOrder: true,
  canViewReports: true,
};

export const ADMIN_PERMISSIONS: UserPermissions = {
  canPlaceOrder: true,
  canExitPosition: true,
  canModifySLTarget: true,
  canCancelOrder: true,
  canViewReports: true,
};

export const DEFAULT_USER_RISK_LIMITS: UserRiskLimits = {
  maxOpenPositions: 5,
  maxOrderQuantity: 900,
  maxDailyLoss: 50000,
  maxOrderNotional: 5000000,
};

export const ADMIN_RISK_LIMITS: UserRiskLimits = {
  maxOpenPositions: 100,
  maxOrderQuantity: 100000,
  maxDailyLoss: 100000000,
  maxOrderNotional: 1000000000,
};

type RawAccessRow = {
  userId: string;
  role: string;
  status: string;
  permissions: unknown;
  riskLimits: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type RawAuditRow = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  action: string;
  details: unknown;
  createdAt: Date;
};

let ensurePromise: Promise<void> | null = null;

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeRole(rawRole: unknown, email?: string | null): UserRole {
  if (isAdminEmail(email)) return 'ADMIN';
  return String(rawRole || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';
}

function normalizeStatus(rawStatus: unknown, email?: string | null): UserStatus {
  if (isAdminEmail(email)) return 'ACTIVE';
  return String(rawStatus || '').toUpperCase() === 'DISABLED' ? 'DISABLED' : 'ACTIVE';
}

function normalizePermissions(raw: unknown, role: UserRole): UserPermissions {
  const obj = parseJsonObject(raw);
  const base = role === 'ADMIN' ? ADMIN_PERMISSIONS : DEFAULT_USER_PERMISSIONS;
  return {
    canPlaceOrder: typeof obj.canPlaceOrder === 'boolean' ? obj.canPlaceOrder : base.canPlaceOrder,
    canExitPosition: typeof obj.canExitPosition === 'boolean' ? obj.canExitPosition : base.canExitPosition,
    canModifySLTarget: typeof obj.canModifySLTarget === 'boolean' ? obj.canModifySLTarget : base.canModifySLTarget,
    canCancelOrder: typeof obj.canCancelOrder === 'boolean' ? obj.canCancelOrder : base.canCancelOrder,
    canViewReports: typeof obj.canViewReports === 'boolean' ? obj.canViewReports : base.canViewReports,
  };
}

function normalizeRiskLimits(raw: unknown, role: UserRole): UserRiskLimits {
  const obj = parseJsonObject(raw);
  const base = role === 'ADMIN' ? ADMIN_RISK_LIMITS : DEFAULT_USER_RISK_LIMITS;
  return {
    maxOpenPositions: Math.floor(clampNumber(obj.maxOpenPositions, base.maxOpenPositions, 1, 1000)),
    maxOrderQuantity: Math.floor(clampNumber(obj.maxOrderQuantity, base.maxOrderQuantity, 1, 1000000)),
    maxDailyLoss: clampNumber(obj.maxDailyLoss, base.maxDailyLoss, 1000, 1000000000),
    maxOrderNotional: clampNumber(obj.maxOrderNotional, base.maxOrderNotional, 10000, 10000000000),
  };
}

function buildDefaultProfile(userId: string, email?: string | null): UserAccessProfile {
  const role: UserRole = isAdminEmail(email) ? 'ADMIN' : 'USER';
  const status: UserStatus = 'ACTIVE';
  const now = new Date();
  return {
    userId,
    role,
    status,
    permissions: role === 'ADMIN' ? ADMIN_PERMISSIONS : DEFAULT_USER_PERMISSIONS,
    riskLimits: role === 'ADMIN' ? ADMIN_RISK_LIMITS : DEFAULT_USER_RISK_LIMITS,
    createdAt: now,
    updatedAt: now,
  };
}

function mapAccessRow(row: RawAccessRow, email?: string | null): UserAccessProfile {
  const role = normalizeRole(row.role, email);
  const status = normalizeStatus(row.status, email);
  return {
    userId: row.userId,
    role,
    status,
    permissions: normalizePermissions(row.permissions, role),
    riskLimits: normalizeRiskLimits(row.riskLimits, role),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function ensureUserAccessTables(): Promise<void> {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserAccessControl" (
        "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
        "role" TEXT NOT NULL DEFAULT 'USER',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "permissions" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "riskLimits" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
        "id" BIGSERIAL PRIMARY KEY,
        "actorUserId" TEXT,
        "actorEmail" TEXT,
        "targetUserId" TEXT,
        "action" TEXT NOT NULL,
        "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx"
      ON "AdminAuditLog" ("createdAt")
    `);
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
}

async function fetchAccessRow(userId: string): Promise<RawAccessRow | null> {
  const rows = await prisma.$queryRaw<RawAccessRow[]>`
    SELECT "userId", "role", "status", "permissions", "riskLimits", "createdAt", "updatedAt"
    FROM "UserAccessControl"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getOrCreateUserAccess(userId: string, email?: string | null): Promise<UserAccessProfile> {
  await ensureUserAccessTables();
  const existing = await fetchAccessRow(userId);

  if (existing) {
    const mapped = mapAccessRow(existing, email);
    if (isAdminEmail(email) && (mapped.role !== 'ADMIN' || mapped.status !== 'ACTIVE')) {
      return upsertUserAccess(userId, email, { role: 'ADMIN', status: 'ACTIVE' });
    }
    return mapped;
  }

  const defaults = buildDefaultProfile(userId, email);
  await prisma.$executeRaw`
    INSERT INTO "UserAccessControl" ("userId", "role", "status", "permissions", "riskLimits", "createdAt", "updatedAt")
    VALUES (
      ${defaults.userId},
      ${defaults.role},
      ${defaults.status},
      ${JSON.stringify(defaults.permissions)}::jsonb,
      ${JSON.stringify(defaults.riskLimits)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId") DO NOTHING
  `;

  const inserted = await fetchAccessRow(userId);
  return inserted ? mapAccessRow(inserted, email) : defaults;
}

export async function upsertUserAccess(
  userId: string,
  email: string | null | undefined,
  updates: {
    role?: UserRole;
    status?: UserStatus;
    permissions?: Partial<UserPermissions>;
    riskLimits?: Partial<UserRiskLimits>;
  }
): Promise<UserAccessProfile> {
  const current = await getOrCreateUserAccess(userId, email);
  const role = normalizeRole(updates.role ?? current.role, email);
  const status = normalizeStatus(updates.status ?? current.status, email);
  const permissions = normalizePermissions(
    { ...current.permissions, ...(updates.permissions ?? {}) },
    role
  );
  const riskLimits = normalizeRiskLimits(
    { ...current.riskLimits, ...(updates.riskLimits ?? {}) },
    role
  );

  await prisma.$executeRaw`
    INSERT INTO "UserAccessControl" ("userId", "role", "status", "permissions", "riskLimits", "createdAt", "updatedAt")
    VALUES (
      ${userId},
      ${role},
      ${status},
      ${JSON.stringify(permissions)}::jsonb,
      ${JSON.stringify(riskLimits)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId")
    DO UPDATE SET
      "role" = EXCLUDED."role",
      "status" = EXCLUDED."status",
      "permissions" = EXCLUDED."permissions",
      "riskLimits" = EXCLUDED."riskLimits",
      "updatedAt" = NOW()
  `;

  const row = await fetchAccessRow(userId);
  return row ? mapAccessRow(row, email) : buildDefaultProfile(userId, email);
}

export async function getUserAccessMap(
  users: Array<{ id: string; email: string | null }>
): Promise<Map<string, UserAccessProfile>> {
  const map = new Map<string, UserAccessProfile>();
  const items = await Promise.all(
    users.map(async (u) => ({ userId: u.id, access: await getOrCreateUserAccess(u.id, u.email) }))
  );
  items.forEach(({ userId, access }) => map.set(userId, access));
  return map;
}

export async function recordAdminAuditLog(input: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  targetUserId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  await ensureUserAccessTables();
  await prisma.$executeRaw`
    INSERT INTO "AdminAuditLog" ("actorUserId", "actorEmail", "targetUserId", "action", "details", "createdAt")
    VALUES (
      ${input.actorUserId ?? null},
      ${input.actorEmail ?? null},
      ${input.targetUserId ?? null},
      ${input.action},
      ${JSON.stringify(input.details ?? {})}::jsonb,
      NOW()
    )
  `;
}

export async function getRecentAdminAuditLogs(limit = 100): Promise<AdminAuditLog[]> {
  await ensureUserAccessTables();
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const rows = await prisma.$queryRaw<RawAuditRow[]>`
    SELECT
      "id"::text AS "id",
      "actorUserId",
      "actorEmail",
      "targetUserId",
      "action",
      "details",
      "createdAt"
    FROM "AdminAuditLog"
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    id: row.id,
    actorUserId: row.actorUserId,
    actorEmail: row.actorEmail,
    targetUserId: row.targetUserId,
    action: row.action,
    details: parseJsonObject(row.details),
    createdAt: row.createdAt,
  }));
}
