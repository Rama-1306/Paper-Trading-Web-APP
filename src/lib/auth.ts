// Auth utility functions for server-side usage
// Main NextAuth config is in src/app/api/auth/[...nextauth]/route.ts

import { getServerSession } from "next-auth";

export async function getSession() {
  return await getServerSession();
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}
