import type { Account } from '@prisma/client';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { getOrCreateUserAccess, type UserAccessProfile } from '@/lib/user-access';

type SessionUser = {
  id?: string | null;
  email?: string | null;
} | null | undefined;

type BasicUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type AuthenticatedUserContext = {
  userId: string;
  user: BasicUser;
  access: UserAccessProfile;
};

export type AuthenticatedAccountContext = AuthenticatedUserContext & {
  account: Account;
};

async function resolveAuthenticatedUser(): Promise<BasicUser | null> {
  const session = await getServerSession();
  const sessionUser = session?.user as SessionUser;
  if (!sessionUser) return null;

  const user = sessionUser.id
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { id: true, email: true, name: true },
      })
    : sessionUser.email
      ? await prisma.user.findUnique({
          where: { email: sessionUser.email },
          select: { id: true, email: true, name: true },
        })
      : null;

  return user ?? null;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await resolveAuthenticatedUser();

  return user?.id ?? null;
}
export async function getAuthenticatedUserContext(): Promise<AuthenticatedUserContext | null> {
  const user = await resolveAuthenticatedUser();
  if (!user) return null;

  const access = await getOrCreateUserAccess(user.id, user.email);
  if (access.status === 'DISABLED') {
    return null;
  }

  return {
    userId: user.id,
    user,
    access,
  };
}

export async function getAuthenticatedAdminContext(): Promise<AuthenticatedUserContext | null> {
  const context = await getAuthenticatedUserContext();
  if (!context) {
    return null;
  }
  if (context.access.role !== 'ADMIN') {
    return null;
  }
  return context;
}

export async function getOrCreateAuthenticatedAccount(): Promise<AuthenticatedAccountContext | null> {
  const context = await getAuthenticatedUserContext();
  if (!context) return null;
  const { userId } = context;

  const existing = await prisma.account.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return { ...context, account: existing };
  }

  const account = await prisma.account.create({
    data: {
      userId,
      name: 'Default',
      balance: 1000000,
      initialBalance: 1000000,
    },
  });
  return { ...context, account };
}
