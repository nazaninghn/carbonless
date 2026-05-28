import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const IS_PROD = process.env.NODE_ENV === 'production';

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  let backendRes;
  try {
    // Fix 28E: abort after 30 s so a hung Django process never blocks the route
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    backendRes = await fetch(`${BACKEND}/accounts/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }

  if (!backendRes.ok) {
    const err = await backendRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: err.detail || err.non_field_errors?.[0] || 'Invalid credentials' },
      { status: backendRes.status }
    );
  }

  const data = await backendRes.json().catch(() => null);
  const { access, refresh } = data ?? {};

  // Guard: a misconfigured backend can return HTTP 200 without tokens.
  // Writing `undefined` to the cookie would store the literal string "undefined"
  // and every subsequent authenticated request would fail silently.
  if (!access || !refresh) {
    return NextResponse.json({ error: 'Unexpected response from auth server' }, { status: 502 });
  }

  const response = NextResponse.json({ access }, { status: 200 });
  response.cookies.set('_carbonless_refresh', refresh, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: 7 * 24 * 3600,
    path: '/',
  });
  return response;
}
