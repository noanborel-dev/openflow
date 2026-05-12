// Section 7 — Privacy. Three-pill flow. Animation polish deferred (per user).
export function Privacy() {
  return (
    <section id="privacy" className="max-w-[1240px] mx-auto px-8 py-16">
      <div
        className="rounded-3xl text-center relative overflow-hidden"
        style={{
          background: "#1a1c22",
          color: "var(--cream)",
          padding: "96px 56px",
          boxShadow: "0 30px 60px -30px rgba(0,0,0,.4)",
        }}
      >
        <p
          className="font-mono text-[11px] tracking-[0.14em] uppercase mb-3"
          style={{ color: "#9efba8" }}
        >
          Section 7 · Privacy
        </p>
        <h2
          className="font-serif font-normal text-[clamp(56px,8vw,80px)] leading-[0.95] tracking-[-0.02em] m-0 mx-auto mb-4"
          style={{ color: "var(--cream)", maxWidth: 820 }}
        >
          Mic → <em>provider</em>. That&apos;s it.
        </h2>
        <p
          className="text-[18px] max-w-[580px] mx-auto m-0 leading-[1.5]"
          style={{ color: "#bcb8a8", marginBottom: 64 }}
        >
          Audio goes straight from your machine to the provider you chose, using
          your key. The polished line comes back. We&apos;re not in the middle.
        </p>

        {/* Three nodes + arrows */}
        <div
          className="flex items-center justify-center max-w-[920px] mx-auto"
          style={{ gap: 0 }}
        >
          <PrivacyNode
            variant="you"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9efba8"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: 40, height: 40 }}
                aria-hidden="true"
              >
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <line x1="12" y1="18" x2="12" y2="21" />
                <line x1="9" y1="21" x2="15" y2="21" />
              </svg>
            }
            label="Your mic"
            meta="on-device"
          />

          <PrivacyArrow />

          <PrivacyNode
            variant="provider"
            icon={
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#fff",
                }}
                aria-hidden="true"
              >
                G
              </span>
            }
            label="Groq · your key"
            meta="over TLS"
          />

          <PrivacyArrow delay="0.8s" />

          <PrivacyNode
            variant="you"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5A8FE8"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: 36, height: 36 }}
                aria-hidden="true"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            }
            label="Pasted"
            meta="on-device"
          />
        </div>

        <p
          className="font-serif italic mt-20 m-0 leading-[1.2]"
          style={{ color: "#9efba8", fontSize: "clamp(22px,3vw,32px)" }}
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

function PrivacyNode({
  variant,
  icon,
  label,
  meta,
}: {
  variant: "you" | "provider";
  icon: React.ReactNode;
  label: string;
  meta: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3.5 flex-none">
      <div
        className="w-[88px] h-[88px] rounded-[20px] flex items-center justify-center"
        style={
          variant === "you"
            ? {
                background: "linear-gradient(135deg,#0e1014,#1a1c22)",
                border: "1px solid #2a2c33",
              }
            : {
                background: "linear-gradient(135deg,#c8553d,#a83f2c)",
                border: "1px solid #c8553d",
              }
        }
      >
        {icon}
      </div>
      <p
        className="font-serif italic text-[22px] m-0"
        style={{ color: "var(--cream)" }}
      >
        {label}
      </p>
      <p
        className="font-mono text-[10px] tracking-[0.1em] uppercase m-0"
        style={{ color: "#9a9789", marginTop: -8 }}
      >
        {meta}
      </p>
    </div>
  );
}

function PrivacyArrow({ delay = "0s" }: { delay?: string }) {
  return (
    <div
      className="relative flex-none self-center"
      style={{ width: 140, height: 2, margin: "0 4px" }}
      aria-hidden="true"
    >
      <span
        className="absolute top-0 left-0"
        style={{
          right: 18,
          height: 2,
          background:
            "repeating-linear-gradient(90deg, #2a2c33 0 6px, transparent 6px 12px)",
        }}
      />
      <span
        className="absolute"
        style={{
          right: 0,
          top: -5,
          width: 0,
          height: 0,
          borderLeft: "8px solid #2a2c33",
          borderTop: "6px solid transparent",
          borderBottom: "6px solid transparent",
        }}
      />
      <span
        className="absolute"
        style={{
          top: -3,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#9efba8",
          boxShadow: "0 0 12px #9efba8",
          animation: "packet-r 2s linear infinite",
          animationDelay: delay,
        }}
      />
    </div>
  );
}
