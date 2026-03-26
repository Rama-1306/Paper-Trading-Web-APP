import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (user) {
      // Find account linked to this user
      const account = await prisma.account.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      if (account) {
        return NextResponse.json({ account }, { status: 200 });
      }
    }

    // Fallback: if no user-linked account found, check for legacy accounts (before auth)
    const legacyAccount = await prisma.account.findFirst({
      where: { userId: null },
      orderBy: { createdAt: "desc" },
    });

    if (legacyAccount) {
      return NextResponse.json({ account: legacyAccount }, { status: 200 });
    }

    // Default response for new users
    return NextResponse.json(
      {
        account: {
          balance: 1000000,
          initialBalance: 1000000,
          realizedPnl: 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Account fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}
