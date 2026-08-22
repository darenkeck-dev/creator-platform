import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { isProtectedPath } from "@/lib/protected-paths";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const shouldEnforceAuth = process.env.NEXT_PUBLIC_ENABLE_AUTH_GUARD === "true";

  if (!shouldEnforceAuth || !isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (authToken && !isExpiredJwt(authToken)) {
    return NextResponse.next();
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const response = NextResponse.json({ message: "Authentication expired" }, { status: 401 });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: "",
      maxAge: 0,
      path: "/"
    });
    return response;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "expired");
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/"
  });
  return response;
}

function isExpiredJwt(token: string) {
  const [, payload] = token.split(".");
  if (!payload) {
    return true;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );
    const decoded = JSON.parse(atob(paddedPayload)) as { exp?: unknown };
    return typeof decoded.exp !== "number" || decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export const config = {
  matcher: [
    "/library/:path*",
    "/upload/:path*",
    "/asset/:path*",
    "/review/:path*",
    "/combos/:path*",
    "/combo/:path*",
    "/releases/:path*",
    "/api/:path*"
  ]
};
