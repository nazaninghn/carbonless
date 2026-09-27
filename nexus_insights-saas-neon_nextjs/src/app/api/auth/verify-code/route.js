import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const IS_PROD = process.env.NODE_ENV === 'production';

// Verifies the emailed signup code and, when the backend signs the user in,
// stores the session exactly like /api/auth/login does, so a new user goes
// straight into the app instead of back to the login form.
export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  let backendRes;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    backendRes = await fetch(`${BACKEND}/accounts/verify-email-code/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body?.email, code: body?.code }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  if (!backendRes.ok) {
    // Pass the error (and its code, for translated messages) through as is.
    return NextResponse.json(data, { status: backendRes.status });
  }

  const { access, refresh, ...rest } = data;
  const response = NextResponse.json({ ...rest, access: access || null }, { status: 200 });
  if (access && refresh) {
    response.cookies.set('_carbonless_refresh', refresh, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'strict',
      maxAge: 7 * 24 * 3600,
      path: '/',
    });
    response.cookies.set('carbonless_auth', '1', {
      httpOnly: false,
      secure: IS_PROD,
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    });
  }
  return response;
}
