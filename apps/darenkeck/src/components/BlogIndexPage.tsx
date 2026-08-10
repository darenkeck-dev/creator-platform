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
      breadcrumbs={[{ label: "darenkeck", to: "/" }, { label: "blog" }]}
      className="blog-document"
    >
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/80">Writing</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Blog</h1>
        <p className="mt-4 max-w-2xl leading-7 text-white/70">
          Notes on software, music, and experiments in how media creates tone.
        </p>
      </header>

      {blogPosts.length ? (
        <ol className="mt-10 divide-y divide-white/15 border-y border-white/15">
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
        <p className="mt-10 border-y border-white/15 py-8 text-white/65">
          No published entries yet.
        </p>
      )}
    </DocumentShell>
  );
}
