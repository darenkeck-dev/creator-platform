import { NextResponse } from "next/server";

import { getCognitoConfig, sanitizeNextPath } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const cognito = getCognitoConfig();
    const url = new URL(request.url);
    const nextPath = sanitizeNextPath(url.searchParams.get("next"));
    const redirectUri = `${url.origin}/auth/callback`;
    const state = Buffer.from(JSON.stringify({ nextPath }), "utf-8").toString("base64url");

    const authorizeUrl = new URL(`${cognito.issuerBaseUrl}/oauth2/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", cognito.clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "openid email profile");
    authorizeUrl.searchParams.set("identity_provider", "Google");
    authorizeUrl.searchParams.set("state", state);

    return NextResponse.redirect(authorizeUrl);
  } catch {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }
}
