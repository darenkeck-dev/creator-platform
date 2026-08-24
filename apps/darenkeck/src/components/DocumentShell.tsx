import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { ContentSizeButton } from "./ContentSizeButton";
import { useDocumentControls } from "./DocumentControlsContext";

type DocumentShellProps = {
  bottomAligned?: boolean;
  breadcrumbs: Array<{ label: string; to?: string }>;
  children: ReactNode;
  className?: string;
  trailingAction?: ReactNode;
};

export function DocumentShell({
  bottomAligned = false,
  breadcrumbs,
  children,
  className = "",
  trailingAction,
}: DocumentShellProps) {
  const documentControls = useDocumentControls();
  const stickySentinelRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  const breadcrumbLabels = breadcrumbs.map((breadcrumb) => breadcrumb.label.toLowerCase());
  const breadcrumbColorClass = breadcrumbLabels.includes("music")
    ? "text-[var(--primary-red)]"
    : breadcrumbLabels.includes("blog")
      ? "text-[var(--primary-orange)]"
      : breadcrumbLabels.includes("news")
        ? "text-[var(--primary-yellow)]"
        : "text-[var(--primary-blue)]";

  useEffect(() => {
    const sentinel = stickySentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      const nextStuck = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      setStuck(nextStuck);
      documentControls?.onStickyChange(nextStuck);
    });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      documentControls?.onStickyChange(false);
    };
  }, [documentControls?.onStickyChange]);
  const bottomControls = !documentControls?.navHidden ? (
    <div
      className="fixed inset-x-0 bottom-0 z-[135] flex h-[max(4rem,calc(env(safe-area-inset-bottom)+3.5rem))] items-center gap-2 border-t border-white/25 bg-black/40 px-4 pb-[env(safe-area-inset-bottom)] text-sm leading-none text-white/65 shadow-[0_-8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md sm:px-6 print:hidden"
      data-media-controls
      data-document-bottom-controls
    >
      {documentControls?.leading ? (
        <div className="flex shrink-0 items-center gap-2" data-document-audio-control>
          {documentControls.leading}
        </div>
      ) : null}
      {trailingAction ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {trailingAction}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <main
        className={`min-h-dvh px-0 pb-[max(4rem,calc(env(safe-area-inset-bottom)+3.5rem))] pt-24 lg:px-6 print:min-h-0 print:p-0 ${bottomAligned ? "flex items-end" : ""}`}
      >
        <div className="mx-auto w-full max-w-4xl">
          <article
            className={`${className} rounded-none border-y bg-black/65 px-6 pb-8 pt-5 shadow-2xl shadow-black/30 backdrop-blur-[10px] sm:px-10 sm:pb-12 sm:pt-6 lg:rounded-2xl lg:border lg:px-14 print:rounded-none print:border-0 print:bg-transparent print:p-0 print:text-black print:shadow-none print:backdrop-blur-none`}
          >
            <div aria-hidden="true" className="-mt-px h-px" ref={stickySentinelRef} />
            <div
              className="sticky top-0 z-20 -mx-6 -mt-5 mb-5 flex min-h-16 w-[calc(100%+3rem)] items-center justify-center bg-black/70 px-6 py-2 text-sm leading-none text-white/65 shadow-lg backdrop-blur-md sm:-mx-10 sm:-mt-6 sm:w-[calc(100%+5rem)] sm:px-10 lg:-mx-14 lg:w-[calc(100%+7rem)] lg:rounded-t-2xl lg:px-14 print:hidden"
              data-document-nav
              data-document-nav-stuck={stuck ? "" : undefined}
            >
              <img
                alt=""
                aria-hidden="true"
                className="absolute left-4 top-1/2 h-8 w-8 -translate-y-1/2 object-contain sm:left-6"
                data-document-favicon
                src="/favicon.png"
              />
              <nav
                aria-label="Breadcrumb"
                className={`absolute left-14 right-24 min-w-0 sm:static sm:max-w-[calc(100%-16rem)] ${breadcrumbColorClass}`}
              >
                <ol className="flex min-w-0 items-center justify-start gap-2 sm:justify-center">
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
                            aria-label={
                              index === 0 && breadcrumb.to === "/" ? "Home" : undefined
                            }
                            className="truncate opacity-70 transition hover:opacity-100"
                            to={breadcrumb.to}
                          >
                            {index === 0 && breadcrumb.to === "/" ? (
                              <svg
                                aria-hidden="true"
                                fill="currentColor"
                                height="18"
                                viewBox="0 0 24 24"
                                width="18"
                              >
                                <path
                                  clipRule="evenodd"
                                  d="M1.5 11.5 12 2.5l10.5 9H18V20H6v-8.5zM9.75 20v-6.5h4.5V20z"
                                  fillRule="evenodd"
                                />
                              </svg>
                            ) : (
                              breadcrumb.label
                            )}
                          </Link>
                        ) : (
                          <span
                            aria-current={current ? "page" : undefined}
                            className="truncate"
                          >
                            {breadcrumb.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
              {documentControls ? (
                <div
                  className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1"
                  data-document-minimize-control
                >
                  {stuck && documentControls.dockedTone ? (
                    <div data-document-tone-control>{documentControls.dockedTone}</div>
                  ) : null}
                  <ContentSizeButton expanded onClick={documentControls.onMinimize} />
                </div>
              ) : null}
            </div>
            {children}
          </article>
        </div>
      </main>
      {bottomControls ? createPortal(bottomControls, document.body) : null}
    </>
  );
}
