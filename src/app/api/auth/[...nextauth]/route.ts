import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "@/lib/db";
import { getOrCreateUserAccess } from "@/lib/user-access";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          return null;
        }
        const access = await getOrCreateUserAccess(user.id, user.email);
        if (access.status === "DISABLED") {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: access.role,
          status: access.status,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      const userId = (user?.id as string | undefined) ?? (token.id as string | undefined);
      if (!userId) {
        return token;
      }

      token.id = userId;

      const emailFromUser = typeof user?.email === "string" ? user.email : null;
      const dbUser = emailFromUser
        ? { email: emailFromUser }
        : await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
          });

      if (!dbUser) {
        token.role = "USER";
        token.status = "DISABLED";
        return token;
      }

      const access = await getOrCreateUserAccess(userId, dbUser?.email ?? null);
      token.role = access.role;
      token.status = access.status;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = (token.role as string) || "USER";
        (session.user as any).status = (token.status as string) || "ACTIVE";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});

export { handler as GET, handler as POST };
