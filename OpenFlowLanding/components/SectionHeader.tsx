interface SectionHeaderProps {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
}

// Shared header used at the top of most sections.
export function SectionHeader({ eyebrow, title, lede }: SectionHeaderProps) {
  return (
    <header className="mb-10">
      <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-accent mb-3">
        {eyebrow}
      </p>
      <h2
        className="font-serif font-normal text-[clamp(48px,7vw,72px)] leading-[0.95] tracking-[-0.02em] max-w-[880px] m-0"
        style={{ marginBottom: lede ? "14px" : 0 }}
      >
        {title}
      </h2>
      {lede && (
        <p className="text-[17px] text-ink-2 max-w-[560px] leading-[1.5] mt-3.5">
          {lede}
        </p>
      )}
    </header>
  );
}
