import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getCognitoConfig, sanitizeNextPath } from "@/lib/auth";

type CallbackState = {
  nextPath?: string;
};

function parseState(rawState: string | null): CallbackState {
  if (!rawState) {
    return {};
  }

  try {
    const decoded = Buffer.from(rawState, "base64url").toString("utf-8");
    return JSON.parse(decoded) as CallbackState;
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError || !code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  let cognito;
  try {
    cognito = getCognitoConfig();
  } catch {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const redirectUri = `${url.origin}/auth/callback`;
  const tokenResponse = await fetch(`${cognito.issuerBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cognito.clientId,
      code,
      redirect_uri: redirectUri
    })
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/login?error=token", request.url));
  }

  const tokenJson = (await tokenResponse.json()) as {
    id_token?: string;
    access_token?: string;
    expires_in?: number;
  };

  const authToken = tokenJson.id_token ?? tokenJson.access_token;
  if (!authToken) {
    return NextResponse.redirect(new URL("/login?error=token", request.url));
  }

  const state = parseState(url.searchParams.get("state"));
  const nextPath = sanitizeNextPath(state.nextPath);

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: authToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: tokenJson.expires_in ?? 3600
  });

  return response;
}
