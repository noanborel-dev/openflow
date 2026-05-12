import { Pill } from "@/components/Pill";

export default function Home() {
  return (
    <main className="min-h-screen px-8 py-16 flex flex-col items-center gap-12">
      <header className="text-center max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent mb-3">
          OpenFlow Landing · Phase 0 scaffold
        </p>
        <h1 className="font-serif text-6xl leading-[0.95] tracking-tight">
          Speak naturally.<br />
          <em>Send without editing.</em>
        </h1>
        <p className="mt-6 text-ink-2 text-lg">
          Scaffold ready. Page sections will be built section-by-section per the
          implementation plan.
        </p>
      </header>

      <section className="flex flex-col items-center gap-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Pill component preview
        </p>
        <div className="flex flex-wrap gap-6 items-center justify-center">
          <Pill state="listening" />
          <Pill state="polishing" />
          <Pill state="done" />
        </div>
      </section>
    </main>
  );
}
