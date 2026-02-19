import Link from "next/link";
import type { ReactNode } from "react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { buttonVariants } from "@/components/ui/button";

const navItems = [
  { href: "/library", label: "Library" },
  { href: "/upload", label: "Upload" },
  { href: "/login", label: "Login" }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/library" className="text-base font-semibold tracking-tight">
            Media Manager
          </Link>
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <Breadcrumbs />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
