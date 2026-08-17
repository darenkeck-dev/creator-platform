import bulletinManifest from "../../.generated-content/bulletins.json";

export type Bulletin = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  summaryText: string;
  image?: string;
  imageAlt?: string;
  content: string;
};

export const bulletins = bulletinManifest.bulletins as Bulletin[];
export const latestBulletins = bulletins.slice(0, 3);

export function findBulletin(slug: string | undefined): Bulletin | undefined {
  return slug ? bulletins.find((bulletin) => bulletin.slug === slug) : undefined;
}

export function formatBulletinDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
