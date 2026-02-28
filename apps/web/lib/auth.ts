export const AUTH_COOKIE_NAME = "mm_auth_token";

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

export function getCognitoConfig() {
  const domain = readRequiredEnv("COGNITO_DOMAIN");
  const clientId = readRequiredEnv("COGNITO_CLIENT_ID");
  const region = process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? "us-west-2";

  const issuerBaseUrl = `https://${domain}.auth.${region}.amazoncognito.com`;

  return {
    domain,
    clientId,
    region,
    issuerBaseUrl
  };
}

export function sanitizeNextPath(nextPath: string | null | undefined): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/library";
  }

  return nextPath;
}
