/**
 * Next.js server-side token refresh proxy
 *
 * Reads the httpOnly _carbonless_refresh first-party cookie,
 * calls the backend refresh endpoint, returns a new access token,
 * and rotates the refresh cookie.
 */

import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const IS_PROD = process.env.NODE_ENV === 'production';

export async function POST(request) {
  const refreshToken = request.cookies.get('_carbonless_refresh')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  let backendRes;
  try {
    backendRes = await fetch(`${BACKEND}/accounts/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }

  if (!backendRes.ok) {
    // Refresh token expired or invalid — clear it
    const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
    response.cookies.delete('_carbonless_refresh');
    return response;
  }

  const data = await backendRes.json();
  const { access, refresh: newRefresh } = data;

  const response = NextResponse.json({ access }, { status: 200 });

  // Rotate the refresh cookie (SimpleJWT blacklists old ones)
  if (newRefresh) {
    response.cookies.set('_carbonless_refresh', newRefresh, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'strict',
      maxAge: 7 * 24 * 3600,
      path: '/',
    });
  }

  return response;
}
