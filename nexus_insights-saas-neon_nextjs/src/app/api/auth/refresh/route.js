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
    // Fix 28E: abort after 30 s so a hung Django process never blocks the route
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    backendRes = await fetch(`${BACKEND}/accounts/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }

  if (!backendRes.ok) {
    const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
    response.cookies.delete('_carbonless_refresh');
    return response;
  }

  const data = await backendRes.json();
  const { access, refresh: newRefresh } = data;

  const response = NextResponse.json({ access }, { status: 200 });
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
