type ProfileHeaderProps = {
  siteLabel?: string;
  title: string;
  description: string;
  secondaryDescription?: string;
};

export function ProfileHeader({
  siteLabel,
  title,
  description,
  secondaryDescription,
}: ProfileHeaderProps) {
  return (
    <header className="space-y-2">
      {siteLabel ? (
        <p className="text-xs uppercase tracking-[0.22em] text-white/70">{siteLabel}</p>
      ) : null}
      <h1 className="text-3xl font-bold text-white">{title}</h1>
      <p className="text-sm leading-relaxed text-white/85">{description}</p>
      {secondaryDescription ? (
        <p className="text-sm leading-relaxed text-white/80">{secondaryDescription}</p>
      ) : null}
    </header>
  );
}
