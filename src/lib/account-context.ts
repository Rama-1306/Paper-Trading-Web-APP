import type { Account } from '@prisma/client';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';

type SessionUser = {
  id?: string | null;
  email?: string | null;
} | null | undefined;

export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getServerSession();
  const sessionUser = session?.user as SessionUser;

  if (!sessionUser) return null;
  if (sessionUser.id) return sessionUser.id;
  if (!sessionUser.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    select: { id: true },
  });

  return user?.id ?? null;
}

export async function getOrCreateAuthenticatedAccount(): Promise<{ userId: string; account: Account } | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const existing = await prisma.account.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return { userId, account: existing };
  }

  const account = await prisma.account.create({
    data: {
      userId,
      name: 'Default',
      balance: 1000000,
      initialBalance: 1000000,
    },
  });

  return { userId, account };
}
