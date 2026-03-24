import { NextRequest, NextResponse } from 'next/server';
import { FyersAPI } from '@/lib/broker/fyers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const authCode = searchParams.get('auth_code');
    const s = searchParams.get('s');

    // Fyers returns s=error if user cancels or something goes wrong
    if (s === 'error' || s === 'nok' || !authCode) {
      // Render a page that shows an error and redirects
      return new NextResponse(
        `<!DOCTYPE html><html><head><title>Login Failed</title></head>
        <body style="background:#0a0e17;color:#ff4444;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2>❌ Fyers Login Failed</h2>
            <p>Please try again.</p>
            <script>setTimeout(()=>window.location.href='/',3000)</script>
          </div>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const fyers = new FyersAPI();
    const accessToken = await fyers.validateAuthCode(authCode);

    // Instead of cookies, render a page that stores token in localStorage then redirects
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Connecting...</title></head>
      <body style="background:#0a0e17;color:#00e676;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2>✅ Fyers Connected Successfully!</h2>
          <p>Redirecting to dashboard...</p>
          <script>
            localStorage.setItem('fyers_access_token', '${accessToken}');
            window.location.href = '/?connected=true';
          </script>
        </div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error: any) {
    console.error('Fyers Callback Error:', error.message);
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Login Failed</title></head>
      <body style="background:#0a0e17;color:#ff4444;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2>❌ Fyers Login Failed</h2>
          <p>${error.message || 'Unknown error'}</p>
          <script>setTimeout(()=>window.location.href='/',3000)</script>
        </div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}
