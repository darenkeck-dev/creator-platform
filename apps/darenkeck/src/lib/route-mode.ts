export function isHomePath(pathname: string): boolean {
  return pathname === "/";
}

export function isDocumentPath(pathname: string): boolean {
  return (
    pathname === "/dev" ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/") ||
    pathname === "/news" ||
    pathname.startsWith("/news/")
  );
}

export function isResumePrintMode(pathname: string, search: string): boolean {
  return pathname === "/dev" && new URLSearchParams(search).get("print") === "1";
}
