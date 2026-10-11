import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    // Check both the JS-set cookie and the httpOnly refresh cookie
    const hasSession = request.cookies.has('carbonless_auth') || request.cookies.has('_carbonless_refresh');

    // Not logged in → send to login
    if (!hasSession) {
      // Keep where the user was going (an e-mail link to the approvals
      // page), so signing in lands there instead of on the mode picker.
      const login = new URL('/login', request.url);
      const target = pathname + request.nextUrl.search;
      if (target !== '/dashboard' && target !== '/dashboard/select') login.searchParams.set('next', target);
      return NextResponse.redirect(login);
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
