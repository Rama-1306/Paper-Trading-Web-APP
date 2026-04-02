import { NextResponse } from "next/server";
import { getOrCreateAuthenticatedAccount } from "@/lib/account-context";

export async function GET() {
  try {
    const context = await getOrCreateAuthenticatedAccount();
    if (!context) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    return NextResponse.json({ account: context.account }, { status: 200 });
  } catch (error) {
    console.error("Account fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}
