import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    await fetch(`${BACKEND}/accounts/logout/`, {
      method: 'POST',
      headers: authHeader ? { Authorization: authHeader } : {},
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {}
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.delete('_carbonless_refresh');
  return response;
}
