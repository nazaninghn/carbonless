import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    // Check both the JS-set cookie and the httpOnly refresh cookie
    const hasSession = request.cookies.has('carbonless_auth') || request.cookies.has('_carbonless_refresh');

    // Not logged in → send to login
    if (!hasSession) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // There is no mode-select step any more: a signed-in user goes straight
    // to the dashboard (which opens on the Carbon Inventory after sign-in).
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
