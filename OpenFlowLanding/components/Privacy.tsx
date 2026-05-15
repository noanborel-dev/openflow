// Section 7 — Privacy. Editorial pass: typographic flow, no boxed diagram.
export function Privacy() {
  return (
    <section id="privacy" className="max-w-[1240px] mx-auto px-8 py-16">
      <div
        className="rounded-3xl text-center relative overflow-hidden"
        style={{
          background: "#1a1c22",
          color: "var(--cream)",
          padding: "120px 56px",
          boxShadow: "0 30px 60px -30px rgba(0,0,0,.4)",
        }}
      >
        <h2
          className="font-serif font-normal text-[clamp(56px,8vw,84px)] leading-[0.95] tracking-[-0.02em] m-0 mx-auto mb-6"
          style={{ color: "var(--cream)", maxWidth: 880 }}
        >
          Mic <em>→</em> your provider. <em>That&apos;s it.</em>
        </h2>
        <p
          className="text-[18px] max-w-[600px] mx-auto m-0 leading-[1.55]"
          style={{ color: "#bcb8a8", marginBottom: 88 }}
        >
          Audio goes straight from your machine to the provider you chose, on
          your key. The polished line comes back. We&apos;re not in the middle.
        </p>

        {/* Editorial flow — three words, two arrows, set in serif italic */}
        <div
          className="privacy-flow"
          aria-label="Audio path: your mic to your provider to your machine"
        >
          <span className="pf-node">
            <span className="pf-word">your mic</span>
            <span className="pf-meta">on-device</span>
          </span>
          <span className="pf-arrow" aria-hidden="true">
            <span className="pf-arrow-line" />
            <span className="pf-arrow-packet" />
            <span className="pf-arrow-tip">→</span>
          </span>
          <span className="pf-node pf-node--accent">
            <span className="pf-word">your provider</span>
            <span className="pf-meta">your key · over TLS</span>
          </span>
          <span className="pf-arrow" aria-hidden="true">
            <span className="pf-arrow-line" />
            <span
              className="pf-arrow-packet"
              style={{ animationDelay: "1s" }}
            />
            <span className="pf-arrow-tip">→</span>
          </span>
          <span className="pf-node">
            <span className="pf-word">your machine</span>
            <span className="pf-meta">pasted</span>
          </span>
        </div>

        <p
          className="font-serif italic m-0 leading-[1.2]"
          style={{
            color: "#9efba8",
            fontSize: "clamp(22px,3vw,32px)",
            marginTop: 88,
          }}
        >
          <strong style={{ color: "var(--cream)", fontWeight: 400 }}>
            Zero bytes
          </strong>{" "}
          of audio touch our servers.
        </p>
      </div>
    </section>
  );
}
