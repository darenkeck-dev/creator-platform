import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getCognitoConfig } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const loginUrl = new URL("/login", request.url);

  let redirectResponse = NextResponse.redirect(loginUrl);

  try {
    const cognito = getCognitoConfig();
    const logoutUrl = new URL(`${cognito.issuerBaseUrl}/logout`);
    logoutUrl.searchParams.set("client_id", cognito.clientId);
    logoutUrl.searchParams.set("logout_uri", `${url.origin}/login`);

    redirectResponse = NextResponse.redirect(logoutUrl);
  } catch {
    redirectResponse = NextResponse.redirect(loginUrl);
  }

  redirectResponse.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/"
  });

  return redirectResponse;
}
