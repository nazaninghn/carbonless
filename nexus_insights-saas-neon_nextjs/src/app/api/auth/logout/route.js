import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  try {
    await fetch(`${BACKEND}/accounts/logout/`, {
      method: 'POST',
      headers: authHeader ? { Authorization: authHeader } : {},
    });
  } catch {}
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.delete('_carbonless_refresh');
  return response;
}
