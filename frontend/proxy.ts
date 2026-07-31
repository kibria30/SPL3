import { NextRequest, NextResponse } from "next/server";

// Optimistic check only -- we just look for the presence of the httpOnly cookie the FastAPI
// backend issues at /auth/login. Real validation (signature, expiry, role) happens server-side
// on every API call; this only exists to redirect obviously-unauthenticated users early.
const COOKIE_NAME = "access_token";
const PUBLIC_ROUTES = ["/login", "/register", "/"];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(COOKIE_NAME);
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (!isPublicRoute && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
