import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const summaryComponents: Components = {
  p: ({ children }) => <span className="block">{children}</span>,
  h1: ({ children }) => <strong className="block font-semibold">{children}</strong>,
  h2: ({ children }) => <strong className="block font-semibold">{children}</strong>,
  h3: ({ children }) => <strong className="block font-semibold">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4">{children}</ol>,
  a: ({ children, href }) => {
    if (!href) return <span>{children}</span>;
    const external = href.startsWith("http");
    return (
      <a
        className="font-medium text-yellow-200 underline decoration-yellow-200/40 underline-offset-2 transition hover:text-yellow-100"
        href={href}
        rel={external ? "noreferrer" : undefined}
        target={external ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  },
};

export function BulletinSummary({ children, className }: { children: string; className: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        allowedElements={[
          "p",
          "h1",
          "h2",
          "h3",
          "ul",
          "ol",
          "li",
          "a",
          "strong",
          "em",
          "del",
          "code",
          "br",
        ]}
        components={summaryComponents}
        remarkPlugins={[remarkGfm]}
        unwrapDisallowed
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
