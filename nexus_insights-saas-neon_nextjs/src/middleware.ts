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

    // /dashboard/select and /dashboard/workspace are always allowed through
    const isSelectPage    = pathname === '/dashboard/select';
    const isWorkspacePage = pathname.startsWith('/dashboard/workspace');
    if (isSelectPage || isWorkspacePage) {
      return NextResponse.next();
    }

    // All other /dashboard/* routes: if no mode cookie → select page first
    const modeChosen = request.cookies.has('carbonless_mode_chosen');
    if (!modeChosen) {
      return NextResponse.redirect(new URL('/dashboard/select', request.url));
    }
  }

  // Redirect logged-in users away from /login and /register → dashboard
  if (pathname === '/login' || pathname === '/register') {
    const hasSession = request.cookies.has('carbonless_auth') || request.cookies.has('_carbonless_refresh');
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
