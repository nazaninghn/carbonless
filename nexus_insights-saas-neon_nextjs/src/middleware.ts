import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware — protects /dashboard routes.
 *
 * We check for the `carbonless_auth` flag cookie which the frontend sets after
 * a successful login. Actual JWT auth is enforced by the backend on every API
 * request; this middleware only handles the routing layer so unauthenticated
 * users are redirected immediately without loading the dashboard bundle.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    const hasSession = request.cookies.has('carbonless_auth');
    if (!hasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('reason', 'session_expired');
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect logged-in users away from /login and /register
  if (pathname === '/login' || pathname === '/register') {
    const hasSession = request.cookies.has('carbonless_auth');
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
