import { useEffect } from "react";
import { Link } from "react-router-dom";

import { blogPosts, formatBlogDate } from "../lib/blog";
import { setPageMetadata } from "../lib/page-metadata";
import { DocumentShell } from "./DocumentShell";

export function BlogIndexPage() {
  useEffect(() => {
    setPageMetadata({
      title: "Blog / Daren Keck",
      description: "Notes and project updates from Daren Keck.",
      url: "https://darenkeck.com/blog",
    });
  }, []);

  return (
    <DocumentShell
      bottomAligned
      breadcrumbs={[{ label: "darenkeck", to: "/" }, { label: "blog" }]}
      className="blog-document"
    >
      {blogPosts.length ? (
        <ol className="divide-y divide-white/15 border-y border-white/15">
          {blogPosts.map((post) => (
            <li key={post.slug}>
              <Link
                className="group grid gap-2 py-6 transition hover:bg-white/[0.04] sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6 sm:px-3"
                to={`/blog/${post.slug}`}
              >
                <time
                  className="text-xs uppercase tracking-[0.14em] text-white/50"
                  dateTime={post.date}
                >
                  {formatBlogDate(post.date)}
                </time>
                <span>
                  <span className="text-xl font-semibold text-white transition group-hover:text-cyan-100">
                    {post.title}
                  </span>
                  {post.summary ? (
                    <span className="mt-2 block leading-6 text-white/65">{post.summary}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-y border-white/15 py-8 text-white/65">No published entries yet.</p>
      )}
    </DocumentShell>
  );
}
