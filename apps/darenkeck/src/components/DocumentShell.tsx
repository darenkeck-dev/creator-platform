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
};

type DocumentNavigationRow = {
  color: string;
  label: string;
  offset: number;
  to: string;
};

const documentNavigationRows: DocumentNavigationRow[] = [
  { color: "var(--primary-blue)", label: "RESUME", offset: 87, to: "/dev" },
  { color: "var(--primary-orange)", label: "BLOG", offset: 56, to: "/blog" },
  { color: "var(--primary-red)", label: "MUSIC", offset: 35, to: "/music" },
  { color: "var(--primary-yellow)", label: "NEWS", offset: 10, to: "/news" },
];

function InactiveDocumentNavigationRows({
  currentLabel,
  navigationOpen,
  onNavigate,
  position,
  rows,
  stuck,
}: {
  currentLabel: string;
  navigationOpen: boolean;
  onNavigate: () => void;
  position: "above" | "below";
  rows: DocumentNavigationRow[];
  stuck: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <div
      aria-hidden={!navigationOpen}
      className={`grid overflow-hidden transition-[backdrop-filter,clip-path,gap,grid-template-rows,margin] duration-300 motion-reduce:transition-none ${stuck && navigationOpen ? "backdrop-blur-[16px] backdrop-brightness-[0.45] backdrop-saturate-[0.55]" : ""} ${navigationOpen ? "[clip-path:inset(0_0_0_0)] ease-out" : "pointer-events-none [clip-path:inset(0_0_0_100%)] ease-in"}`}
      data-document-navigation-rows={position}
      inert={!navigationOpen}
      style={{
        gap: navigationOpen ? "4px" : "0px",
        gridTemplateRows: `repeat(${rows.length}, ${navigationOpen ? "40px" : "0px"})`,
        marginBottom: position === "above" && navigationOpen ? "4px" : "0px",
        marginTop: position === "below" && navigationOpen ? "4px" : "0px",
      }}
    >
      {rows.map(({ color, label, offset, to }) => {
        const textAnchor = offset === 10 ? "start" : offset === 87 ? "end" : "middle";
        const maskId = `document-menu-${currentLabel.toLowerCase()}-${label.toLowerCase()}-mask`;
        const edgeMaskId = `document-menu-${currentLabel.toLowerCase()}-${label.toLowerCase()}-edge-mask`;
        return (
          <Link
            className={`group relative block min-h-0 overflow-hidden transition-[backdrop-filter,filter] hover:brightness-110 ${stuck && navigationOpen ? "" : "backdrop-blur-[4px]"}`}
            data-document-navigation-row={label.toLowerCase()}
            key={to}
            onClick={onNavigate}
            to={to}
          >
            <svg aria-hidden="true" className="h-full w-full overflow-hidden">
              <defs>
                <mask id={maskId}>
                  <rect fill="white" height="100%" width="100%" />
                  <text
                    dominantBaseline="central"
                    fill="#333333"
                    fontFamily="inherit"
                    fontSize="44"
                    fontWeight="900"
                    letterSpacing="0.5"
                    textAnchor={textAnchor}
                    x={`${offset}%`}
                    y="50%"
                  >
                    {label}
                  </text>
                </mask>
                <mask id={edgeMaskId}>
                  <rect fill="white" height="100%" width="100%" />
                  <text
                    dominantBaseline="central"
                    fill="black"
                    fontFamily="inherit"
                    fontSize="44"
                    fontWeight="900"
                    letterSpacing="0.5"
                    textAnchor={textAnchor}
                    x={`${offset}%`}
                    y="50%"
                  >
                    {label}
                  </text>
                </mask>
              </defs>
              <rect
                data-document-navigation-row-fill
                fill={color}
                fillOpacity={stuck ? "0.94" : "0.72"}
                height="100%"
                mask={`url(#${maskId})`}
                width="100%"
              />
              <text
                data-document-navigation-label-edge="dark"
                dominantBaseline="central"
                fill="none"
                fontFamily="inherit"
                fontSize="44"
                fontWeight="900"
                letterSpacing="0.5"
                mask={`url(#${edgeMaskId})`}
                stroke="rgba(0,0,0,0.62)"
                strokeLinejoin="round"
                strokeWidth="1"
                textAnchor={textAnchor}
                x={`${offset}%`}
                y="50%"
              >
                {label}
              </text>
            </svg>
            <span className="sr-only">{`${label[0]}${label.slice(1).toLowerCase()}`}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function DocumentShell({
  bottomAligned = false,
  breadcrumbs,
  children,
  className = "",
}: DocumentShellProps) {
  const documentControls = useDocumentControls();
  const stickySentinelRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const breadcrumbLabels = breadcrumbs.map((breadcrumb) => breadcrumb.label.toLowerCase());
  const sectionNavigation =
    documentNavigationRows.find((row) => breadcrumbLabels.includes(row.label.toLowerCase())) ??
    documentNavigationRows[0]!;
  const sectionNavigationIndex = documentNavigationRows.indexOf(sectionNavigation);
  const navigationRowsAbove = documentNavigationRows.slice(0, sectionNavigationIndex);
  const navigationRowsBelow = documentNavigationRows.slice(sectionNavigationIndex + 1);
  const sectionMaskId = `document-navigation-${sectionNavigation.label.toLowerCase()}-mask`;
  const sectionEdgeMaskId = `document-navigation-${sectionNavigation.label.toLowerCase()}-edge-mask`;
  const sectionTextAnchor = sectionNavigation.offset === 10 ? "start" : sectionNavigation.offset === 87 ? "end" : "middle";

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
  const bottomControls = documentControls && !documentControls.navHidden ? (
    <div
      className="fixed bottom-0 left-1/2 z-[135] grid h-[max(4rem,calc(env(safe-area-inset-bottom)+3.5rem))] w-full max-w-4xl -translate-x-1/2 grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 border-t border-white/25 bg-black/40 px-4 pb-[env(safe-area-inset-bottom)] text-sm leading-none text-white/65 shadow-[0_-8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md min-[360px]:grid-cols-[7rem_minmax(0,1fr)_7rem] sm:px-6 print:hidden"
      data-media-controls
      data-document-bottom-controls
    >
      {documentControls?.leading ? (
        <div className="col-start-1 flex shrink-0 items-center gap-2" data-document-audio-control>
          {documentControls.leading}
        </div>
      ) : null}
      {documentControls?.center ? (
        <div className="col-start-2 min-w-0 justify-self-center text-center" data-document-center-control>
          {documentControls.center}
        </div>
      ) : null}
      <div className="col-start-3 flex shrink-0 items-center justify-self-end gap-2">
        <ContentSizeButton expanded onClick={documentControls.onMinimize} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <main
        className={`min-h-dvh px-0 pb-[max(4rem,calc(env(safe-area-inset-bottom)+3.5rem))] pt-24 lg:px-6 print:min-h-0 print:p-0 ${bottomAligned ? "flex items-end" : ""}`}
      >
        <div className="mx-auto w-full max-w-4xl">
          <article
            className={`${className} rounded-none print:text-black`}
          >
            <div aria-hidden="true" className="-mt-px h-px" ref={stickySentinelRef} />
            <div
              className={`sticky top-0 z-20 w-full print:hidden ${stuck ? "h-10" : ""}`}
              data-document-nav
              data-document-nav-stuck={stuck ? "" : undefined}
            >
              <InactiveDocumentNavigationRows
                currentLabel={sectionNavigation.label}
                navigationOpen={navigationOpen}
                onNavigate={() => setNavigationOpen(false)}
                position="above"
                rows={navigationRowsAbove}
                stuck={stuck}
              />
              <div
                className={`relative flex h-10 w-full items-center transition-[backdrop-filter] duration-200 ${stuck ? "backdrop-blur-xl" : "backdrop-blur-sm"}`}
                data-document-current-nav
              >
                <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-hidden">
                <defs>
                  <mask id={sectionMaskId}>
                    <rect fill="white" height="100%" width="100%" />
                    <text
                      dominantBaseline="central"
                      fill="#333333"
                      fontFamily="inherit"
                      fontSize="44"
                      fontWeight="900"
                      letterSpacing="0.5"
                      textAnchor={sectionTextAnchor}
                      x={`${sectionNavigation.offset}%`}
                      y="50%"
                    >
                      {sectionNavigation.label}
                    </text>
                  </mask>
                  <mask id={sectionEdgeMaskId}>
                    <rect fill="white" height="100%" width="100%" />
                    <text
                      dominantBaseline="central"
                      fill="black"
                      fontFamily="inherit"
                      fontSize="44"
                      fontWeight="900"
                      letterSpacing="0.5"
                      textAnchor={sectionTextAnchor}
                      x={`${sectionNavigation.offset}%`}
                      y="50%"
                    >
                      {sectionNavigation.label}
                    </text>
                  </mask>
                </defs>
                <rect
                  data-document-nav-fill
                  fill={sectionNavigation.color}
                  fillOpacity={stuck ? "0.94" : "0.72"}
                  height="100%"
                  mask={`url(#${sectionMaskId})`}
                  width="100%"
                />
                <text
                  data-document-label-edge="dark"
                  dominantBaseline="central"
                  fill="none"
                  fontFamily="inherit"
                  fontSize="44"
                  fontWeight="900"
                  letterSpacing="0.5"
                  mask={`url(#${sectionEdgeMaskId})`}
                  stroke="rgba(0,0,0,0.62)"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  textAnchor={sectionTextAnchor}
                  x={`${sectionNavigation.offset}%`}
                  y="50%"
                >
                  {sectionNavigation.label}
                </text>
              </svg>
              <Link
                aria-label="Home"
                className="absolute left-2 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white transition hover:bg-black/25 sm:left-4"
                data-document-home-link
                to="/"
              >
                <svg
                  aria-hidden="true"
                  fill="currentColor"
                  height="20"
                  viewBox="0 0 24 24"
                  width="20"
                >
                  <path
                    clipRule="evenodd"
                    d="M1.5 11.5 12 2.5l10.5 9H18V20H6v-8.5zM9.75 20v-6.5h4.5V20z"
                    fillRule="evenodd"
                  />
                </svg>
              </Link>
              <Link
                aria-label={`${sectionNavigation.label[0]}${sectionNavigation.label.slice(1).toLowerCase()}`}
                className="absolute top-0 z-10 flex h-full items-center text-[44px] font-black leading-none tracking-[0.5px] text-transparent no-underline"
                data-document-section-link
                style={{
                  left: `${sectionNavigation.offset}%`,
                  transform:
                    sectionTextAnchor === "start"
                      ? undefined
                      : sectionTextAnchor === "end"
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                }}
                to={sectionNavigation.to}
              >
                {sectionNavigation.label}
              </Link>
              <span
                aria-hidden="true"
                data-document-section-offset={sectionNavigation.offset}
              />
              <div
                className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1"
                data-document-navigation-controls
              >
                {stuck && documentControls?.dockedTone ? (
                  <div
                    className="flex h-8 w-8 items-center justify-center leading-none [&_[data-tone-control]]:!h-8 [&_[data-tone-control]]:!w-8 [&_[data-tone-control]]:!rounded-none [&_[data-tone-control]]:!bg-transparent [&_[data-tone-control]]:!shadow-none [&_[data-tone-control]]:!backdrop-blur-none [&_[data-tone-control]]:hover:!bg-black/20"
                    data-document-tone-control
                  >
                    {documentControls.dockedTone}
                  </div>
                ) : null}
                <button
                  aria-expanded={navigationOpen}
                  aria-label={navigationOpen ? "Hide navigation" : "Show navigation"}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors duration-200 hover:bg-black/25 motion-reduce:transition-none"
                  data-document-navigation-toggle
                  onClick={() => setNavigationOpen((open) => !open)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="20"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                    width="20"
                  >
                    <path
                      className={`origin-center transition-[opacity,transform] duration-200 motion-reduce:transition-none ${navigationOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`}
                      d="M5 7h14M5 12h14M5 17h14"
                      data-document-navigation-icon="hamburger"
                    />
                    <path
                      className={`origin-center transition-[opacity,transform] duration-200 motion-reduce:transition-none ${navigationOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`}
                      d="m6 9 6 6 6-6"
                      data-document-navigation-icon="caret"
                    />
                  </svg>
                </button>
              </div>
            </div>
              <InactiveDocumentNavigationRows
                currentLabel={sectionNavigation.label}
                navigationOpen={navigationOpen}
                onNavigate={() => setNavigationOpen(false)}
                position="below"
                rows={navigationRowsBelow}
                stuck={stuck}
              />
            </div>
            <div
              className="mt-2 border-b border-white/25 bg-black/65 px-6 pb-8 pt-5 shadow-2xl shadow-black/30 backdrop-blur-[10px] sm:px-10 sm:pb-12 sm:pt-6 lg:rounded-b-2xl lg:border-x lg:border-b lg:px-14 print:mt-0 print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none print:backdrop-blur-none"
              data-document-content-surface
            >
              {children}
            </div>
          </article>
        </div>
      </main>
      {bottomControls ? createPortal(bottomControls, document.body) : null}
    </>
  );
}
