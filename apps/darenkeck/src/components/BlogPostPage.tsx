import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { findBlogPost, formatBlogDate } from "../lib/blog";
import { setPageMetadata } from "../lib/page-metadata";
import { DocumentMarkdown } from "./DocumentMarkdown";
import { DocumentShell } from "./DocumentShell";

export function BlogPostPage() {
  const { slug } = useParams();
  const post = findBlogPost(slug);

  useEffect(() => {
    if (!post) {
      setPageMetadata({
        title: "Blog entry not found / Daren Keck",
        description: "The requested blog entry does not exist.",
        url: window.location.href,
        index: false,
      });
      return;
    }
    setPageMetadata({
      title: `${post.title} / Daren Keck`,
      description:
        post.summary ?? `A blog entry from Daren Keck published ${formatBlogDate(post.date)}.`,
      url: `https://darenkeck.com/blog/${post.slug}`,
    });
  }, [post]);

  if (!post) {
    return (
      <DocumentShell
        breadcrumbs={[
          { label: "darenkeck", to: "/" },
          { label: "blog", to: "/blog" },
          { label: "not found" },
        ]}
      >
        <h1 className="text-3xl font-bold text-white">Blog entry not found</h1>
        <p className="mt-4 text-white/70">This entry may have moved or is not published.</p>
      </DocumentShell>
    );
  }

  return (
    <DocumentShell
      breadcrumbs={[
        { label: "darenkeck", to: "/" },
        { label: "blog", to: "/blog" },
        { label: post.title },
      ]}
      className="blog-document"
    >
      <header className="mb-10 border-b border-white/20 pb-8">
        <time className="text-xs uppercase tracking-[0.16em] text-cyan-200/80" dateTime={post.date}>
          {formatBlogDate(post.date)}
        </time>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {post.title}
        </h1>
        {post.summary ? (
          <p className="mt-4 text-lg leading-7 text-white/70">{post.summary}</p>
        ) : null}
      </header>
      <DocumentMarkdown>{post.content}</DocumentMarkdown>
    </DocumentShell>
  );
}
