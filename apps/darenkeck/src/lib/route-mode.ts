export function isHomePath(pathname: string): boolean {
  return pathname === "/";
}

export function isResumePrintMode(pathname: string, search: string): boolean {
  return pathname === "/dev" && new URLSearchParams(search).get("print") === "1";
}
