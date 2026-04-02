import { NextResponse } from 'next/server';
import { FyersAPI } from '@/lib/broker/fyers';
import { getAuthenticatedAdminContext } from '@/lib/account-context';

export async function GET() {
  try {
    const admin = await getAuthenticatedAdminContext();
    if (!admin) {
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
