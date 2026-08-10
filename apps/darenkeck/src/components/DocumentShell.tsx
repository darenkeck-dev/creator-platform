import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type DocumentShellProps = {
  breadcrumbs: Array<{ label: string; to?: string }>;
  children: ReactNode;
  className?: string;
  trailingAction?: ReactNode;
};

export function DocumentShell({
  breadcrumbs,
  children,
  className = "",
  trailingAction,
}: DocumentShellProps) {
  return (
    <main className="min-h-dvh px-4 pb-6 pt-24 sm:px-6 sm:pb-10 sm:pt-24 print:min-h-0 print:p-0">
      <div className="mx-auto w-full max-w-4xl">
        <article
          className={`${className} rounded-2xl border bg-black/65 px-6 pb-8 pt-5 shadow-2xl shadow-black/30 backdrop-blur-[10px] sm:px-10 sm:pb-12 sm:pt-6 lg:px-14 print:rounded-none print:border-0 print:bg-transparent print:p-0 print:text-black print:shadow-none print:backdrop-blur-none`}
        >
          <div className="mb-5 flex items-center justify-between gap-4 text-sm leading-none text-white/65 print:hidden">
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-2">
                {breadcrumbs.map((breadcrumb, index) => {
                  const current = index === breadcrumbs.length - 1;
                  return (
                    <li
                      className="flex min-w-0 items-center gap-2"
                      key={`${breadcrumb.label}-${index}`}
                    >
                      {index > 0 ? <span aria-hidden="true">/</span> : null}
                      {breadcrumb.to ? (
                        <Link
                          className="truncate text-white/70 transition hover:text-white"
                          to={breadcrumb.to}
                        >
                          {breadcrumb.label}
                        </Link>
                      ) : (
                        <span
                          aria-current={current ? "page" : undefined}
                          className="truncate text-white"
                        >
                          {breadcrumb.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
            {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
          </div>
          {children}
        </article>
      </div>
    </main>
  );
}
