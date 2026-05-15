"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClaudeCodeShell } from "./shells/ClaudeCodeShell";
import { CursorShell } from "./shells/CursorShell";
import { ChatGPTShell } from "./shells/ChatGPTShell";
import { TerminalShell } from "./shells/TerminalShell";
import { Pill } from "./Pill";

type Target = "claude" | "cursor" | "chatgpt" | "terminal";
type Phase = "listening" | "polishing" | "pasted";

const TARGETS: Array<{
  id: Target;
  name: string;
  logoSrc?: string;
  glyph?: string;
}> = [
  { id: "claude", name: "Claude Code", logoSrc: "/logos/claudecode.png" },
  { id: "cursor", name: "Cursor", logoSrc: "/logos/cursor.png" },
  { id: "chatgpt", name: "ChatGPT", logoSrc: "/logos/chatgpt.png" },
  { id: "terminal", name: "Terminal", glyph: "›_" },
];

const POLISHED: Record<Target, string> = {
  claude:
    "Refactor the polish pipeline to stream chunks instead of waiting for the full transcript, and add a fallback to local whisper.cpp if Groq returns 429.",
  cursor:
    "Could you make it easier to switch certificates in the transport listeners?",
  chatgpt:
    "Walk me through how a Vercel edge function actually runs versus a regular serverless function.",
  terminal:
    'gh pr create --title "feat: per-app polish defaults" --body "polish defaults for slack imessage gmail"',
};

export function AiCoding() {
  const [active, setActive] = useState<Target>("claude");
  const [phase, setPhase] = useState<Phase>("listening");
  const [flashing, setFlashing] = useState(false);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cleanup = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timeoutsRef.current.push(t);
  }, []);

  const runFlow = useCallback(
    (target: Target) => {
      cleanup();
      setActive(target);
      setPhase("listening");
      setFlashing(false);

      // 1. Listening — 2.2s
      schedule(() => setPhase("polishing"), 2200);
      // 2. Polishing — 0.9s
      schedule(() => {
        setPhase("pasted");
        setFlashing(true);
      }, 3100);
      // 3. Drop flash after 0.6s so the animation can replay next loop
      schedule(() => setFlashing(false), 3700);

      // 4. Hold ~3s, then advance
      schedule(() => {
        const order: Target[] = ["claude", "cursor", "chatgpt", "terminal"];
        const next = order[(order.indexOf(target) + 1) % order.length];
        runFlow(next);
      }, 6100);
    },
    [cleanup, schedule],
  );

  useEffect(() => {
    runFlow("claude");
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = phase === "pasted" ? POLISHED[active] : "";

  return (
    <section id="ai-coding" className="max-w-[1240px] mx-auto px-8 py-16">
      <h2 className="font-serif font-normal text-[clamp(56px,8vw,72px)] leading-[0.95] tracking-[-0.02em] m-0 mb-4 max-w-[880px]">
        Talk to your <em>tools</em>.
      </h2>
      <p className="text-[17px] text-ink-2 max-w-[560px] mb-10 leading-[1.5]">
        Dictate straight into Claude Code, Cursor, ChatGPT, or the terminal.
      </p>

      <div className="ai-stage">
        <div className="ai-side">
          <p className="font-serif italic text-[24px] m-0 mb-5 leading-[1.1]">
            Talk to →
          </p>

          {TARGETS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ai-row ${active === t.id ? "on" : ""}`}
              onClick={() => runFlow(t.id)}
              aria-pressed={active === t.id}
            >
              <span className="ai-row__logo">
                {t.logoSrc ? (
                  <Image src={t.logoSrc} alt={t.name} width={24} height={24} />
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 14,
                      color: "#9efba8",
                      background: "#1d1f21",
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {t.glyph}
                  </span>
                )}
              </span>
              <span className="ai-row__name">{t.name}</span>
            </button>
          ))}
        </div>

        <div className="ai-canvas">
          {TARGETS.map((t) => {
            const isActive = t.id === active;
            const props = {
              text: isActive ? text : "",
              flashing: isActive && flashing,
            };
            return (
              <div
                key={t.id}
                className={`ai-app ${isActive ? "active" : ""}`}
                aria-hidden={!isActive}
              >
                {t.id === "claude" && <ClaudeCodeShell {...props} />}
                {t.id === "cursor" && <CursorShell {...props} />}
                {t.id === "chatgpt" && <ChatGPTShell {...props} />}
                {t.id === "terminal" && <TerminalShell {...props} />}
              </div>
            );
          })}

          <div className="ai-pill-wrap">
            <Pill state={phase === "pasted" ? "done" : phase} label={
              phase === "pasted" ? "pasted" : undefined
            } />
          </div>
        </div>
      </div>
    </section>
  );
}
