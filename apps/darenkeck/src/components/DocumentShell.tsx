import type { ReactNode } from "react";
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

  return (
    <main
      className={`min-h-dvh px-0 pb-6 pt-24 lg:px-6 lg:pb-10 print:min-h-0 print:p-0 ${bottomAligned ? "flex items-end" : ""}`}
    >
      <div className="mx-auto w-full max-w-4xl">
        <article
          className={`${className} rounded-none border-y bg-black/65 px-6 pb-8 pt-5 shadow-2xl shadow-black/30 backdrop-blur-[10px] sm:px-10 sm:pb-12 sm:pt-6 lg:rounded-2xl lg:border lg:px-14 print:rounded-none print:border-0 print:bg-transparent print:p-0 print:text-black print:shadow-none print:backdrop-blur-none`}
        >
          <div
            className="sticky top-0 z-20 -mx-6 -mt-5 mb-5 flex w-[calc(100%+3rem)] items-center gap-2 bg-[linear-gradient(to_bottom,rgba(0,0,0,1)_0%,rgba(0,0,0,0.1)_100%)] px-6 py-4 text-sm leading-none text-white/65 shadow-lg backdrop-blur-md sm:-mx-10 sm:-mt-6 sm:w-[calc(100%+5rem)] sm:px-10 lg:-mx-14 lg:w-[calc(100%+7rem)] lg:rounded-t-2xl lg:px-14 print:static print:mx-0 print:mt-0 print:mb-4 print:w-full print:rounded-none print:bg-transparent print:p-0 print:shadow-none print:backdrop-blur-none print:hidden"
            data-document-nav
          >
            {documentControls ? (
              <div
                className="absolute right-1 top-1/2 z-10 -translate-y-1/2"
                data-document-minimize-control
              >
                <ContentSizeButton expanded onClick={documentControls.onMinimize} />
              </div>
            ) : null}
            {documentControls?.leading ? (
              <div className="shrink-0" data-document-audio-control>
                {documentControls.leading}
              </div>
            ) : null}
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center justify-center gap-2 lg:justify-start">
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
                          aria-label={index === 0 && breadcrumb.to === "/" ? "Home" : undefined}
                          className="truncate text-white/70 transition hover:text-white"
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
            {trailingAction || documentControls?.trailing ? (
              <div className="mr-8 flex shrink-0 items-center gap-2">
                {trailingAction}
                {documentControls?.trailing ? (
                  <div data-document-tone-control>{documentControls.trailing}</div>
                ) : null}
              </div>
            ) : null}
          </div>
          {children}
        </article>
      </div>
    </main>
  );
}
