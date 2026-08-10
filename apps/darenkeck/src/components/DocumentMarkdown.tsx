import ReactMarkdown, { type Components } from "react-markdown";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

const documentComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl print:m-0 print:text-[26pt] print:leading-[1.1] print:text-black print:break-after-avoid">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-12 border-b border-white/20 pb-3 text-xl font-semibold uppercase tracking-[0.12em] text-white print:mt-[0.22in] print:border-gray-400 print:pb-[0.04in] print:text-[12pt] print:leading-[1.2] print:text-black print:break-after-avoid">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 text-lg font-semibold text-white print:mt-[0.16in] print:text-[10.5pt] print:leading-[1.2] print:text-black print:break-after-avoid">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mt-4 leading-7 text-white/80 print:mt-[0.08in] print:text-[9.5pt] print:leading-[1.35] print:text-black">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-white/80 marker:text-cyan-300 print:mt-[0.08in] print:space-y-[0.025in] print:pl-[0.22in] print:text-black print:marker:text-black print:break-inside-avoid">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-white/80 marker:text-cyan-300 print:mt-[0.08in] print:space-y-[0.025in] print:pl-[0.22in] print:text-black print:marker:text-black print:break-inside-avoid">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-1 leading-7 print:text-[9.5pt] print:leading-[1.35] print:text-black print:break-inside-avoid">
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-white print:text-black">{children}</strong>
  ),
  a: ({ children, href }) => {
    if (!href) return <span className="text-cyan-200 print:text-black">{children}</span>;
    const external = href.startsWith("http");
    return (
      <a
        className="text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 transition hover:text-cyan-100 print:text-black print:decoration-black print:decoration-[0.75pt]"
        href={href}
        rel={external ? "noreferrer" : undefined}
        target={external ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="mt-5 border-l-2 border-cyan-300/60 pl-5 italic text-white/70 print:border-gray-400 print:text-black print:break-inside-avoid">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div
      className="my-7 overflow-x-auto rounded-xl border border-white/20 print:overflow-visible print:rounded-none print:border-gray-400"
      data-markdown-table
    >
      <table className="w-full min-w-[38rem] border-collapse text-left text-sm print:min-w-0 print:text-[8.5pt]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-white/25 bg-white/10 text-white print:border-gray-500 print:bg-gray-100 print:text-black">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-white/15 text-white/75 print:divide-gray-300 print:text-black">
      {children}
    </tbody>
  ),
  tr: ({ children }) => <tr className="align-top">{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-3 font-semibold leading-5 text-white print:px-[0.08in] print:py-[0.05in] print:text-black">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 leading-6 print:px-[0.08in] print:py-[0.05in] print:leading-[1.25]">
      {children}
    </td>
  ),
  img: ({ alt, src, title }) => (
    <img
      alt={alt ?? ""}
      className="my-6 block h-auto max-w-full rounded-xl shadow-lg print:my-[0.12in] print:max-h-[8in] print:break-inside-avoid print:rounded-none print:shadow-none"
      decoding="async"
      loading="eager"
      src={src}
      title={title}
    />
  ),
  hr: () => <hr className="my-10 border-white/20 print:border-gray-400" />,
};

export function DocumentMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown components={documentComponents} remarkPlugins={[remarkFrontmatter, remarkGfm]}>
      {children}
    </ReactMarkdown>
  );
}
