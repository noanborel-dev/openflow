import { SectionHeader } from "./SectionHeader";

const ITEMS: Array<{ q: React.ReactNode; a: React.ReactNode }> = [
  {
    q: "Does OpenFlow ever hear my audio?",
    a: "No. Audio uploads go from the client straight to your chosen provider, using your key, over TLS. OpenFlow servers are not in the path. The polished text comes back to your device and gets pasted locally.",
  },
  {
    q: (
      <>
        How is this different from <em>Wispr Flow</em>?
      </>
    ),
    a: "Wispr proxies your audio through their servers on their plan. OpenFlow doesn't proxy anything — your audio goes straight to the provider, using your own key. Polish is calibrated per destination app (iMessage stays lowercase, Gmail keeps its greeting). Cost, audio path, and tone are yours, not ours.",
  },
  {
    q: "Which providers work?",
    a: "Today: Groq (free tier, recommended) for transcription, OpenAI Whisper as an alternative, and Anthropic Claude for the polish pass. Local Whisper via whisper.cpp is on the roadmap.",
  },
  {
    q: "What about Windows and Linux?",
    a: "macOS is GA. Windows is in private beta. Linux (PipeWire) is coming.",
  },
  {
    q: "Can I run it fully offline?",
    a: "Yes — point OpenFlow at a local whisper.cpp endpoint. The pill turns slate-grey to indicate local-only mode.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="max-w-[1240px] mx-auto px-8 py-16">
      <SectionHeader
        title={
          <>
            Worth <em>answering</em>.
          </>
        }
        lede="Five we get asked the most."
      />

      <div
        className="bg-white border border-line rounded-3xl p-14"
        style={{ boxShadow: "0 30px 60px -30px rgba(20,30,50,.18)" }}
      >
        <div className="flex flex-col border-t border-line-soft">
          {ITEMS.map((item, i) => (
            <details
              key={i}
              className="border-b border-line-soft py-5 cursor-pointer group"
              open={i === 0}
            >
              <summary
                className="list-none flex justify-between items-center gap-6 text-ink leading-[1.1]"
                style={{ listStyle: "none" }}
              >
                <span className="font-serif text-[26px] font-normal">
                  {item.q}
                </span>
                <span
                  className="font-mono text-[22px] text-accent flex-none not-italic group-open:hidden"
                  aria-hidden="true"
                >
                  +
                </span>
                <span
                  className="font-mono text-[22px] text-accent flex-none not-italic hidden group-open:inline"
                  aria-hidden="true"
                >
                  −
                </span>
              </summary>
              <p className="mt-3.5 max-w-[780px] text-[15.5px] leading-[1.55] text-ink-2">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
