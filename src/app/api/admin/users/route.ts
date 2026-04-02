import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import prisma from '@/lib/db';
import { isAdminEmail } from '@/lib/admin';
import { getAuthenticatedAdminContext } from '@/lib/account-context';
import {
  ADMIN_PERMISSIONS,
  ADMIN_RISK_LIMITS,
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_RISK_LIMITS,
  getRecentAdminAuditLogs,
  getUserAccessMap,
  recordAdminAuditLog,
  upsertUserAccess,
  type UserPermissions,
  type UserRiskLimits,
} from '@/lib/user-access';

const MIN_PASSWORD_LENGTH = 6;

type AdminAction =
  | 'purge_non_admin'
  | 'create_user'
  | 'update_user'
  | 'reset_password';
const ADMIN_ACTIONS: AdminAction[] = ['purge_non_admin', 'create_user', 'update_user', 'reset_password'];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function pickPermissions(raw: unknown): Partial<UserPermissions> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  return {
    canPlaceOrder: typeof src.canPlaceOrder === 'boolean' ? src.canPlaceOrder : undefined,
    canExitPosition: typeof src.canExitPosition === 'boolean' ? src.canExitPosition : undefined,
    canModifySLTarget: typeof src.canModifySLTarget === 'boolean' ? src.canModifySLTarget : undefined,
    canCancelOrder: typeof src.canCancelOrder === 'boolean' ? src.canCancelOrder : undefined,
    canViewReports: typeof src.canViewReports === 'boolean' ? src.canViewReports : undefined,
  };
}

function pickRiskLimits(raw: unknown): Partial<UserRiskLimits> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  const asNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    maxOpenPositions: asNum(src.maxOpenPositions),
    maxOrderQuantity: asNum(src.maxOrderQuantity),
    maxDailyLoss: asNum(src.maxDailyLoss),
    maxOrderNotional: asNum(src.maxOrderNotional),
  };
}

async function requireAdmin() {
  const context = await getAuthenticatedAdminContext();
  if (!context) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }
  return { ok: true as const, context };
}

async function buildAdminUsersPayload() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          accounts: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const accessMap = await getUserAccessMap(users.map((u) => ({ id: u.id, email: u.email })));

  const mappedUsers = users.map((u) => {
    const access = accessMap.get(u.id);
    const role = access?.role ?? (isAdminEmail(u.email) ? 'ADMIN' : 'USER');
    const status = access?.status ?? 'ACTIVE';
    return {
      ...u,
      role,
      status,
      permissions: access?.permissions ?? (role === 'ADMIN' ? ADMIN_PERMISSIONS : DEFAULT_USER_PERMISSIONS),
      riskLimits: access?.riskLimits ?? (role === 'ADMIN' ? ADMIN_RISK_LIMITS : DEFAULT_USER_RISK_LIMITS),
      isConfiguredAdmin: isAdminEmail(u.email),
    };
  });

  const auditLogs = await getRecentAdminAuditLogs(120);

  return {
    users: mappedUsers,
    summary: {
      totalUsers: mappedUsers.length,
      adminUsers: mappedUsers.filter((u) => u.role === 'ADMIN').length,
      nonAdminUsers: mappedUsers.filter((u) => u.role !== 'ADMIN').length,
      activeUsers: mappedUsers.filter((u) => u.status === 'ACTIVE').length,
      disabledUsers: mappedUsers.filter((u) => u.status === 'DISABLED').length,
    },
    auditLogs,
  };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return auth.response;
    }
    return NextResponse.json(await buildAdminUsersPayload());
  } catch (error) {
    console.error('Admin users GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return auth.response;
    }
    const { context } = auth;

    const body = await request.json().catch(() => ({}));
    const rawAction = String(body?.action || 'purge_non_admin');
    const action: AdminAction = ADMIN_ACTIONS.includes(rawAction as AdminAction)
      ? (rawAction as AdminAction)
      : 'purge_non_admin';

    if (action === 'create_user') {
      const name = String(body?.name || '').trim();
      const email = normalizeEmail(String(body?.email || ''));
      const password = String(body?.password || '');

      if (!name || !email || !password) {
        return NextResponse.json({ error: 'name, email and password are required' }, { status: 400 });
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
      }

      const hashedPassword = await hash(password, 12);
      const created = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          accounts: {
            create: {
              name: 'Default',
              balance: 1000000,
              initialBalance: 1000000,
            },
          },
        },
        select: { id: true, email: true },
      });

      await upsertUserAccess(created.id, created.email, {
        role: isAdminEmail(created.email) ? 'ADMIN' : 'USER',
        status: 'ACTIVE',
        permissions: DEFAULT_USER_PERMISSIONS,
        riskLimits: DEFAULT_USER_RISK_LIMITS,
      });

      await recordAdminAuditLog({
        actorUserId: context.userId,
        actorEmail: context.user.email,
        targetUserId: created.id,
        action: 'CREATE_USER',
        details: { email: created.email, name },
      });

      return NextResponse.json({
        success: true,
        message: 'User created successfully',
        data: await buildAdminUsersPayload(),
      });
    }

    if (action === 'update_user') {
      const userId = String(body?.userId || '').trim();
      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });
      if (!target) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const role = body?.role === 'ADMIN' || body?.role === 'USER' ? body.role : undefined;
      const status = body?.status === 'ACTIVE' || body?.status === 'DISABLED' ? body.status : undefined;
      const permissions = pickPermissions(body?.permissions);
      const riskLimits = pickRiskLimits(body?.riskLimits);

      const updatedAccess = await upsertUserAccess(target.id, target.email, {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(permissions ? { permissions } : {}),
        ...(riskLimits ? { riskLimits } : {}),
      });

      await recordAdminAuditLog({
        actorUserId: context.userId,
        actorEmail: context.user.email,
        targetUserId: target.id,
        action: 'UPDATE_USER_ACCESS',
        details: {
          role: updatedAccess.role,
          status: updatedAccess.status,
          permissions: updatedAccess.permissions,
          riskLimits: updatedAccess.riskLimits,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'User access updated',
        data: await buildAdminUsersPayload(),
      });
    }

    if (action === 'reset_password') {
      const userId = String(body?.userId || '').trim();
      const newPassword = String(body?.newPassword || '');
      if (!userId || !newPassword) {
        return NextResponse.json({ error: 'userId and newPassword are required' }, { status: 400 });
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
      }

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });
      if (!target) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const password = await hash(newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { password },
      });

      await recordAdminAuditLog({
        actorUserId: context.userId,
        actorEmail: context.user.email,
        targetUserId: target.id,
        action: 'RESET_PASSWORD',
        details: { email: target.email },
      });

      return NextResponse.json({
        success: true,
        message: 'Password reset successful',
        data: await buildAdminUsersPayload(),
      });
    }

    if (action !== 'purge_non_admin') {
      return NextResponse.json({ error: 'Unsupported admin action' }, { status: 400 });
    }

    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });
    const accessMap = await getUserAccessMap(allUsers.map((u) => ({ id: u.id, email: u.email })));

    const removableUserIds = allUsers
      .filter((u) => (accessMap.get(u.id)?.role ?? (isAdminEmail(u.email) ? 'ADMIN' : 'USER')) !== 'ADMIN')
      .map((u) => u.id);

    const removableAccounts = await prisma.account.findMany({
      where: {
        OR: [
          { userId: null },
          { userId: { in: removableUserIds } },
        ],
      },
      select: { id: true },
    });

    const accountIds = removableAccounts.map((a) => a.id);

    const [positions, orders, trades, watchlists] = accountIds.length
      ? await Promise.all([
          prisma.position.count({ where: { accountId: { in: accountIds } } }),
          prisma.order.count({ where: { accountId: { in: accountIds } } }),
          prisma.trade.count({ where: { accountId: { in: accountIds } } }),
          prisma.watchlist.count({ where: { accountId: { in: accountIds } } }),
        ])
      : [0, 0, 0, 0];

    await prisma.$transaction(async (tx) => {
      if (accountIds.length > 0) {
        await tx.position.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.order.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.trade.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.watchlist.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.account.deleteMany({ where: { id: { in: accountIds } } });
      }
      if (removableUserIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: removableUserIds } } });
      }
    });

    await recordAdminAuditLog({
      actorUserId: context.userId,
      actorEmail: context.user.email,
      action: 'PURGE_NON_ADMIN_USERS',
      details: {
        users: removableUserIds.length,
        accounts: accountIds.length,
        positions,
        orders,
        trades,
        watchlists,
      },
    });

    return NextResponse.json({
      success: true,
      removed: {
        users: removableUserIds.length,
        accounts: accountIds.length,
        positions,
        orders,
        trades,
        watchlists,
      },
      data: await buildAdminUsersPayload(),
    });
  } catch (error) {
    console.error('Admin users POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
