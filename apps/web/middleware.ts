import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const protectedPaths = ["/library", "/upload", "/asset"];

function isProtectedPath(pathname: string) {
  return protectedPaths.some((protectedPath) => {
    return pathname === protectedPath || pathname.startsWith(`${protectedPath}/`);
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const shouldEnforceAuth = process.env.NEXT_PUBLIC_ENABLE_AUTH_GUARD === "true";

  if (!shouldEnforceAuth || !isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get("mm_auth_token")?.value;
  if (authToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/library/:path*", "/upload/:path*", "/asset/:path*"]
};
