import prisma from '@/lib/db';

const SHARED_PROVIDER = 'FYERS';

let sharedFyersToken: string | null = null;
let ensurePromise: Promise<void> | null = null;

function normalizeToken(token: string | null | undefined): string | null {
  const normalized = token?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

async function ensureSharedBrokerStateTable(): Promise<void> {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SharedBrokerState" (
      "provider" TEXT PRIMARY KEY,
      "accessToken" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).then(() => undefined);

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
}

export async function setSharedFyersToken(token: string | null | undefined) {
  const normalized = normalizeToken(token);
  sharedFyersToken = normalized;
  try {
    await ensureSharedBrokerStateTable();
    await prisma.$executeRaw`
      INSERT INTO "SharedBrokerState" ("provider", "accessToken", "updatedAt")
      VALUES (${SHARED_PROVIDER}, ${normalized}, NOW())
      ON CONFLICT ("provider")
      DO UPDATE SET
        "accessToken" = EXCLUDED."accessToken",
        "updatedAt" = NOW()
    `;
  } catch (error) {
    console.error('Shared Fyers token persistence failed:', error);
  }
}

export async function getSharedFyersToken(): Promise<string | null> {
  if (sharedFyersToken) {
    return sharedFyersToken;
  }
  try {
    await ensureSharedBrokerStateTable();
    const rows = await prisma.$queryRaw<Array<{ accessToken: string | null }>>`
      SELECT "accessToken"
      FROM "SharedBrokerState"
      WHERE "provider" = ${SHARED_PROVIDER}
      LIMIT 1
    `;
    const token = normalizeToken(rows[0]?.accessToken);
    sharedFyersToken = token;
    return token;
  } catch (error) {
    console.error('Shared Fyers token load failed:', error);
    return null;
  }
}
