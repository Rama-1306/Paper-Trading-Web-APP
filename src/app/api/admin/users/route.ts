import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { getConfiguredAdminEmail, isAdminEmail } from '@/lib/admin';

async function requireAdmin() {
  const session = await getServerSession();
  const email = session?.user?.email ?? null;

  if (!isAdminEmail(email)) {
    return { ok: false as const, response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return { ok: true as const, email: email!.trim().toLowerCase() };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return auth.response;
    }

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

    const nonAdminUsers = users.filter((u) => !isAdminEmail(u.email));

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        role: isAdminEmail(u.email) ? 'ADMIN' : 'USER',
      })),
      summary: {
        totalUsers: users.length,
        adminUsers: users.length - nonAdminUsers.length,
        nonAdminUsers: nonAdminUsers.length,
      },
    });
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

    const body = await request.json().catch(() => ({}));
    const action = body?.action || 'purge_non_admin';

    if (action !== 'purge_non_admin') {
      return NextResponse.json({ error: 'Unsupported admin action' }, { status: 400 });
    }

    const adminEmail = getConfiguredAdminEmail();
    if (!adminEmail) {
      return NextResponse.json({ error: 'Admin email not configured on server' }, { status: 500 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true, email: true },
    });

    if (!adminUser) {
      return NextResponse.json({ error: 'Configured admin user not found' }, { status: 404 });
    }

    const removableUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: null },
          { email: { not: adminEmail } },
        ],
      },
      select: { id: true },
    });

    const removableAccounts = await prisma.account.findMany({
      where: {
        OR: [
          { userId: null },
          { userId: { not: adminUser.id } },
        ],
      },
      select: { id: true },
    });

    const accountIds = removableAccounts.map((a) => a.id);
    const userIds = removableUsers.map((u) => u.id);

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
      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }
    });

    return NextResponse.json({
      success: true,
      removed: {
        users: userIds.length,
        accounts: accountIds.length,
        positions,
        orders,
        trades,
        watchlists,
      },
    });
  } catch (error) {
    console.error('Admin users POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
