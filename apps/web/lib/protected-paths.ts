export const PROTECTED_APP_PATHS = [
  "/library",
  "/upload",
  "/asset",
  "/review",
  "/combos",
  "/combo",
  "/releases",
  "/api",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_APP_PATHS.some(
    (protectedPath) => pathname === protectedPath || pathname.startsWith(`${protectedPath}/`)
  );
}
