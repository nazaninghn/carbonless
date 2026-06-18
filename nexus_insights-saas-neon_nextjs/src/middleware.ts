import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    const hasSession  = request.cookies.has('carbonless_auth');

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

  // Redirect logged-in users away from /login and /register → select page
  if (pathname === '/login' || pathname === '/register') {
    const hasSession = request.cookies.has('carbonless_auth');
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard/select', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
