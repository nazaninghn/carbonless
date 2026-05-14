/**
 * Next.js server-side logout proxy — clears the httpOnly refresh cookie.
 */

import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function POST(request) {
  // Optionally tell the backend to blacklist the refresh token
  const refreshToken = request.cookies.get('_carbonless_refresh')?.value;
  const authHeader = request.headers.get('authorization') || '';

  try {
    await fetch(`${BACKEND}/accounts/logout/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });
  } catch { /* best-effort */ }

  const response = NextResponse.json({ status: 'ok' }, { status: 200 });
  response.cookies.delete('_carbonless_refresh');
  return response;
}
