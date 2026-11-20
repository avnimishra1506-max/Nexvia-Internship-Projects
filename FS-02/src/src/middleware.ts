/**
 * src/middleware.ts
 * ───────────────────────────────────────────────────────────
 * Next.js Edge Middleware — route protection.
 *
 * Protected routes: /dashboard, /workspace, /document
 * Public routes:    /login, /signup, /api/auth, /
 *
 * If the session_token cookie is missing on a protected route,
 * the user is redirected to /login.
 * ───────────────────────────────────────────────────────────
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require a valid session
const PROTECTED_PREFIXES = ["/dashboard", "/workspace", "/document"];

// Routes that should redirect to /dashboard if already logged in
const AUTH_ROUTES = ["/login", "/signup"];

const SESSION_COOKIE = "session_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users away from protected pages
  if (isProtected && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname); // preserve intended destination
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from /login and /signup
  if (isAuthRoute && sessionToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Match all routes EXCEPT:
   *  - _next/static  (static assets)
   *  - _next/image   (image optimizer)
   *  - favicon.ico
   *  - public files  (images, icons, etc.)
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

