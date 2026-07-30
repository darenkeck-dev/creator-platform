type PageMetadata = {
  title: string;
  description: string;
  url: string;
  index?: boolean;
};

function setMetaContent(selector: string, content: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", content);
}

export function setPageMetadata({ title, description, url, index = true }: PageMetadata) {
  document.title = title;
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", url);
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[name="robots"]', index ? "index, follow" : "noindex, nofollow");
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', url);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
}
