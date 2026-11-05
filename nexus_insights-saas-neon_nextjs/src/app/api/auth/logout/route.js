import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  // The refresh token lives in an HttpOnly cookie of THIS app, so the backend never sees it unless it is passed on:
  // without it, signing out only deleted the cookie and the token stayed valid at the server. The backend blacklists it.
  const refresh = request.cookies.get('_carbonless_refresh')?.value;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    await fetch(`${BACKEND}/accounts/logout/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
      body: JSON.stringify(refresh ? { refresh } : {}),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {}
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.delete('_carbonless_refresh');
  return response;
}
