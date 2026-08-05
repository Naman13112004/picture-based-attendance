// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // 1. Get the token from cookies
  const token = request.cookies.get('token')?.value;
  const userCookie = request.cookies.get('user')?.value;

  // 2. Define protected routes
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register');

  // Parse user cookie once
  let role: string | null = null;
  if (userCookie) {
    try {
      // js-cookie URI-encodes the value, so we must decode it
      role = JSON.parse(decodeURIComponent(userCookie)).role;
    } catch (e) {
      // Invalid user cookie
      role = null;
    }
  }

  // If we have a token but no valid role, they need to log in again to restore their user cookie
  if (token && !role && isDashboardRoute) {
    // TODO: Eventually validate a backend JWT instead of relying purely on a client-controlled user cookie.
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. Scenario: Unauthenticated user trying to access dashboard
  if (isDashboardRoute && (!token || !role)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 4. Scenario: Authenticated user trying to access login/register
  if (isAuthRoute && token && role) {
    // Redirect to their specific dashboard based on role
    if (role === 'TEACHER') {
        return NextResponse.redirect(new URL('/dashboard/teacher', request.url));
    } else {
        return NextResponse.redirect(new URL('/dashboard/student', request.url));
    }
  }

  // 5. (Optional) Role-based protection
  // If a student tries to access /dashboard/teacher, kick them out
  if (request.nextUrl.pathname.startsWith('/dashboard/teacher') && role !== 'TEACHER') {
    return NextResponse.redirect(new URL('/dashboard/student', request.url));
  }
  
  // If a teacher tries to access /dashboard/student, kick them out
  if (request.nextUrl.pathname.startsWith('/dashboard/student') && role !== 'STUDENT') {
    return NextResponse.redirect(new URL('/dashboard/teacher', request.url));
  }

  return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/login', 
    '/register'
  ],
};