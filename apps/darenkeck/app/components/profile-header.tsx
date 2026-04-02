type ProfileHeaderProps = {
  siteLabel: string;
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
      <p className="text-xs uppercase tracking-[0.22em] text-white/70">{siteLabel}</p>
      <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="text-sm leading-relaxed text-white/80">{description}</p>
      {secondaryDescription ? (
        <p className="text-sm leading-relaxed text-white/80">{secondaryDescription}</p>
      ) : null}
    </header>
  );
}
