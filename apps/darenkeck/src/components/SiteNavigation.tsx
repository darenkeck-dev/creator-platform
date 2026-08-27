import { useLayoutEffect, useState } from "react";

type SiteNavigationKey = "resume" | "blog" | "music" | "news";

export type SiteNavigationItem = {
  color: string;
  key: SiteNavigationKey;
  label: "RESUME" | "BLOG" | "MUSIC" | "NEWS";
  route: string;
  textAnchor: "start" | "middle" | "end";
  x: number;
};

const NAVIGATION_EDGE_INSET = 10;
const NAVIGATION_STEP = (100 - NAVIGATION_EDGE_INSET * 2) / 3;
const navigationPosition = (index: number) =>
  Number((NAVIGATION_EDGE_INSET + NAVIGATION_STEP * index).toFixed(3));

export const SITE_NAVIGATION_ITEMS: SiteNavigationItem[] = [
  {
    color: "var(--primary-blue)",
    key: "resume",
    label: "RESUME",
    route: "/dev",
    textAnchor: "end",
    x: navigationPosition(3),
  },
  {
    color: "var(--primary-orange)",
    key: "blog",
    label: "BLOG",
    route: "/blog",
    textAnchor: "middle",
    x: 51,
  },
  {
    color: "var(--primary-red)",
    key: "music",
    label: "MUSIC",
    route: "/music",
    textAnchor: "middle",
    x: navigationPosition(1),
  },
  {
    color: "var(--primary-yellow)",
    key: "news",
    label: "NEWS",
    route: "/news",
    textAnchor: "start",
    x: navigationPosition(0),
  },
];

function measureNavigationLabels(fontFamily: string): Record<SiteNavigationKey, number> {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "fixed";
  svg.style.visibility = "hidden";
  svg.style.width = "0";
  svg.style.height = "0";
  document.body.append(svg);

  const widths = {} as Record<SiteNavigationKey, number>;
  for (const item of SITE_NAVIGATION_ITEMS) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("font-family", fontFamily);
    text.setAttribute("font-size", "44");
    text.setAttribute("font-weight", "900");
    text.setAttribute("letter-spacing", "0.5");
    text.textContent = item.label;
    svg.append(text);
    widths[item.key] = text.getComputedTextLength();
  }

  svg.remove();
  return widths;
}

export function useSiteNavigationLayout<T extends HTMLElement>() {
  const [container, setContainer] = useState<T | null>(null);
  const [positions, setPositions] = useState<Partial<Record<SiteNavigationKey, number>>>({});

  useLayoutEffect(() => {
    if (!container) return;
    let cancelled = false;

    const calculate = () => {
      const width = container.getBoundingClientRect().width;
      if (width <= 0) return;
      const labelWidths = measureNavigationLabels(getComputedStyle(container).fontFamily);
      const inset = width * (NAVIGATION_EDGE_INSET / 100);
      const newsCenter = inset + labelWidths.news / 2;
      const resumeCenter = width - inset - labelWidths.resume / 2;
      const visualStep = (resumeCenter - newsCenter) / 3;
      const nextPositions = {
        news: inset,
        music: newsCenter + visualStep,
        blog: newsCenter + visualStep * 2,
        resume: width - inset,
      };
      if (!cancelled) setPositions(nextPositions);
    };

    calculate();
    const observer = new ResizeObserver(calculate);
    observer.observe(container);
    void document.fonts?.ready.then(calculate);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [container]);

  return { containerRef: setContainer, positions };
}

export function NavigationRowGraphic({
  edgeMaskId,
  fillOpacity,
  item,
  maskId,
  position,
  variant,
}: {
  edgeMaskId: string;
  fillOpacity?: string;
  item: SiteNavigationItem;
  maskId: string;
  position?: number;
  variant: "home" | "document-inactive" | "document-current";
}) {
  const fillAttributes =
    variant === "home"
      ? { "data-navigation-row-fill": "" }
      : variant === "document-inactive"
        ? { "data-document-navigation-row-fill": "" }
        : { "data-document-nav-fill": "" };
  const edgeAttributes =
    variant === "home"
      ? { "data-navigation-label-edge": "dark" }
      : variant === "document-inactive"
        ? { "data-document-navigation-label-edge": "dark" }
        : { "data-document-label-edge": "dark" };

  return (
    <svg aria-hidden="true" className="h-full w-full overflow-hidden">
      <defs>
        <mask id={maskId}>
          <rect fill="white" height="100%" width="100%" />
          <text
            data-navigation-label-position={item.key}
            dominantBaseline="central"
            fill="#333333"
            fontFamily="inherit"
            fontSize="44"
            fontWeight="900"
            letterSpacing="0.5"
            textAnchor={item.textAnchor}
            x={position ?? `${item.x}%`}
            y="50%"
          >
            {item.label}
          </text>
        </mask>
        <mask id={edgeMaskId}>
          <rect fill="white" height="100%" width="100%" />
          <text
            data-navigation-label-position={item.key}
            dominantBaseline="central"
            fill="black"
            fontFamily="inherit"
            fontSize="44"
            fontWeight="900"
            letterSpacing="0.5"
            textAnchor={item.textAnchor}
            x={position ?? `${item.x}%`}
            y="50%"
          >
            {item.label}
          </text>
        </mask>
      </defs>
      <rect
        {...fillAttributes}
        fill={item.color}
        fillOpacity={fillOpacity}
        height="100%"
        mask={`url(#${maskId})`}
        width="100%"
      />
      <text
        {...edgeAttributes}
        data-navigation-label-position={item.key}
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
        textAnchor={item.textAnchor}
        x={position ?? `${item.x}%`}
        y="50%"
      >
        {item.label}
      </text>
    </svg>
  );
}
