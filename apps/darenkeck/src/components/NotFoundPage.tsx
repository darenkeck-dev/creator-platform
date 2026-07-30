import { useEffect } from "react";
import { Link } from "react-router-dom";

import { setPageMetadata } from "../lib/page-metadata";

export function NotFoundPage() {
  useEffect(() => {
    setPageMetadata({
      title: "Page not found / Daren Keck",
      description: "The requested page does not exist.",
      url: window.location.href,
      index: false,
    });
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <section className="glass-card w-full max-w-lg rounded-2xl border p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-white/60">404</p>
        <h1 className="mt-4 text-3xl font-bold text-white">Page not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          The page you requested does not exist.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full border px-4 py-2 text-xs text-white/90 transition hover:bg-white/10"
          to="/"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
