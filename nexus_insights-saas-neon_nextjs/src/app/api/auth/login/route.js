/**
 * Next.js server-side login proxy
 *
 * Why: Frontend (Vercel) and backend (Render) are on different domains.
 * Cross-site cookies are blocked by Safari ITP, iOS, Edge, and Firefox.
 * By proxying through a same-origin Next.js route we eliminate ALL
 * cross-site issues — the browser only ever talks to its own domain.
 *
 * Flow:
 *  browser → POST /api/auth/login (same-origin, Next.js)
 *         → Next.js server → POST backend/accounts/login/ (server-to-server)
 *         ← gets { access, refresh }
 *  browser ← { access } + httpOnly first-party cookie _carbonless_refresh
 *
 * The refresh token lives in a httpOnly SameSite=Strict first-party cookie.
 * This is unreadable by JavaScript (XSS-safe) and never blocked by ITP.
 * The access token is returned in the body for the frontend to keep in memory.
 */

import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const IS_PROD = process.env.NODE_ENV === 'production';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  let backendRes;
  try {
    backendRes = await fetch(`${BACKEND}/accounts/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
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

  const data = await backendRes.json();
  const { access, refresh } = data;

  if (!access || !refresh) {
    return NextResponse.json({ error: 'Unexpected backend response' }, { status: 502 });
  }

  // Return access token in body (frontend stores in memory / localStorage)
  const response = NextResponse.json({ access }, { status: 200 });

  // Store refresh token in httpOnly first-party cookie
  // SameSite=Strict + first-party = never blocked by any browser/ITP
  response.cookies.set('_carbonless_refresh', refresh, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: 7 * 24 * 3600, // 7 days
    path: '/',
  });

  return response;
}
