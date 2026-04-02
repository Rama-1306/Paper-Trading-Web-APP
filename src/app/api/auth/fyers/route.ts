import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { FyersAPI } from '@/lib/broker/fyers';
import { isAdminEmail } from '@/lib/admin';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: 'Only admin can connect Fyers' }, { status: 403 });
    }
    const fyers = new FyersAPI();
    const loginUrl = fyers.getLoginUrl();
    
    // Redirect user to Fyers login page
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    console.error('Failed to generate Fyers login URL:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
