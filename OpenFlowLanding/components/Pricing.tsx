import { SectionHeader } from "./SectionHeader";

export function Pricing() {
  return (
    <section id="pricing" className="max-w-[1240px] mx-auto px-8 py-16">
      <SectionHeader
        eyebrow="Section 8 · Pricing"
        title={
          <>
            Free. <em>Actually.</em>
          </>
        }
        lede="OpenFlow costs nothing. Groq's free tier covers most users at the volume real humans dictate at."
      />

      <div
        className="grid gap-16 items-center bg-white border border-line rounded-3xl p-14"
        style={{
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          boxShadow: "0 30px 60px -30px rgba(20,30,50,.18)",
        }}
      >
        {/* Left: price card */}
        <div
          className="rounded-[18px] border border-line p-[40px]"
          style={{
            background: "linear-gradient(170deg,#fbf9f1,#efe9d8)",
          }}
        >
          <p className="font-serif italic text-[32px] leading-none mb-1">
            OpenFlow
          </p>
          <p className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-muted mb-6">
            Forever · no account
          </p>
          <div className="font-serif flex items-baseline gap-1.5 mb-2">
            <span className="text-[36px] text-muted leading-none">$</span>
            <span className="text-[96px] leading-none tracking-[-0.02em]">
              0
            </span>
          </div>
          <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-muted mb-8">
            per month, per anything
          </p>
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5 text-[14.5px] mb-8">
            {[
              "Unlimited dictations",
              "Tap · hold · double-tap",
              "Custom dictionary & pronunciations",
              "Polish per app",
              "macOS — Windows & Linux soon",
            ].map((item) => (
              <li key={item} className="flex gap-2.5 items-start">
                <span className="text-accent font-bold text-[20px] leading-none">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <a
            href="#download"
            className="inline-flex items-center gap-2.5 bg-ink text-cream px-[22px] py-3.5 rounded-full text-[14.5px] font-semibold no-underline"
          >
            Download for Mac
            <span
              className="font-mono font-medium px-[7px] py-[2px] rounded text-[12px]"
              style={{
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.18)",
              }}
            >
              ⌘ ⇧ D
            </span>
          </a>
        </div>

        {/* Right: BYOK note + Groq card */}
        <div className="flex flex-col gap-6">
          <p className="font-serif italic text-[30px] leading-[1.2] m-0">
            You bring{" "}
            <span className="text-accent">your own key</span>. We never touch
            your card.
          </p>

          <div
            className="rounded-[14px] border border-line p-6 flex items-center gap-4"
            style={{ background: "var(--paper)" }}
          >
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center text-white font-bold text-xl"
              style={{
                background: "linear-gradient(135deg,#f06043,#c8553d)",
                fontFamily: "var(--font-sans)",
              }}
              aria-hidden="true"
            >
              G
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-serif italic text-[20px] m-0 leading-none">
                Groq Whisper
              </p>
              <p className="text-[13px] text-muted m-0">
                Default provider. Recommended.
              </p>
            </div>
            <p
              className="ml-auto font-mono text-[12px] font-semibold px-3 py-1.5 rounded-full m-0"
              style={{
                color: "#2d7a4f",
                background: "rgba(45,122,79,.08)",
              }}
            >
              Free tier
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
