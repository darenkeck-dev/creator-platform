import blogManifest from "../../.generated-content/blog.json";

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  summary?: string;
  content: string;
};

export const blogPosts = blogManifest.posts as BlogPost[];

export function findBlogPost(slug: string | undefined): BlogPost | undefined {
  return slug ? blogPosts.find((post) => post.slug === slug) : undefined;
}

export function formatBlogDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
