import { useEffect } from "react";
import { useRouteError } from "react-router-dom";

const CHUNK_RELOAD_KEY = "darenkeck:stale-chunk-reload:v1";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

export function isStaleChunkError(error: unknown): boolean {
  return /(?:not a valid JavaScript MIME type|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk .* failed)/i.test(
    errorMessage(error)
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  const staleChunk = isStaleChunkError(error);

  useEffect(() => {
    console.error("Darenkeck route error", error);
    if (!staleChunk) return;
    const reloadToken = `${window.location.pathname}${window.location.search}`;
    if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === reloadToken) return;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, reloadToken);
    window.location.reload();
  }, [error, staleChunk]);

  const reload = () => {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-5 py-12 text-white">
      <section className="glass-card w-full max-w-lg rounded-2xl border p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-white/60">
          {staleChunk ? "Site update" : "Application error"}
        </p>
        <h1 className="mt-4 text-3xl font-bold">
          {staleChunk ? "Refresh required" : "Something went wrong"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          {staleChunk
            ? "A newer version of this page is available. Refresh to continue."
            : "The page could not be displayed. Refreshing may resolve the problem."}
        </p>
        <button
          className="mt-6 inline-flex rounded-full border px-4 py-2 text-xs text-white/90 transition hover:bg-white/10"
          onClick={reload}
          type="button"
        >
          Refresh page
        </button>
      </section>
    </main>
  );
}
