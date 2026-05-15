"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pillBus } from "./pillBus";

type FloatState = "idle" | "listening" | "polishing" | "done";

export function FloatingPill() {
  const [state, setState] = useState<FloatState>("idle");
  const [showHint, setShowHint] = useState(true);
  const [interacted, setInteracted] = useState(false);
  const barsRef = useRef<HTMLSpanElement>(null);
  const holdingRef = useRef(false);
  const stateRef = useRef<FloatState>("idle");
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tappedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    return pillBus.on((e) => {
      if (e === "hold-start") setState("listening");
      else if (e === "hold-end") setState("polishing");
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 4500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (state !== "listening" || !barsRef.current) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const spans = barsRef.current.querySelectorAll("span");
    const interval = setInterval(() => {
      spans.forEach((s) => {
        (s as HTMLElement).style.height = `${3 + Math.random() * 11}px`;
      });
    }, 220);
    return () => clearInterval(interval);
  }, [state]);

  // Auto-advance: polishing → done → idle. Split into two effects so that
  // each transition's timer doesn't get torn down when state moves on.
  useEffect(() => {
    if (state !== "polishing") return;
    const t = setTimeout(() => setState("done"), 900);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (state !== "done") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const scrollToDemo = () => {
    const el = document.getElementById("demo");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startHold = useCallback(() => {
    if (holdingRef.current) return;
    if (stateRef.current !== "idle") return;
    holdingRef.current = true;
    setInteracted(true);
    setShowHint(false);
    pillBus.emit("hold-start");
  }, []);

  const endHold = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    pillBus.emit("hold-end");
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    tappedRef.current = true;
    pressTimerRef.current = setTimeout(() => {
      tappedRef.current = false;
      startHold();
    }, 180);
  };
  const onPointerUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (holdingRef.current) {
      endHold();
    } else if (tappedRef.current) {
      tappedRef.current = false;
      setInteracted(true);
      setShowHint(false);
      pillBus.emit("tap");
      scrollToDemo();
    }
  };
  const onPointerLeave = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (holdingRef.current) endHold();
  };

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== "Control") return;
      if (e.repeat) return;
      startHold();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== "Control") return;
      endHold();
    };
    const onBlur = () => endHold();
    document.addEventListener("keydown", onDown);
    document.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onDown);
      document.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [startHold, endHold]);

  return (
    <div className="floating-pill-wrap" aria-live="polite">
      {!interacted && showHint && (
        <div className="floating-pill-hint">
          tap to demo · hold <span className="kbd">⌃</span> to dictate
        </div>
      )}

      <button
        type="button"
        className={`floating-pill state-${state}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        aria-label={
          state === "idle"
            ? "OpenFlow — tap to scroll to demo, hold to dictate"
            : state === "listening"
              ? "listening"
              : state === "polishing"
                ? "polishing"
                : "done"
        }
      >
        {state === "idle" && (
          <>
            <span className="pill-dot" aria-hidden="true" />
            <span className="floating-pill-label">OpenFlow</span>
          </>
        )}

        {state === "listening" && (
          <>
            <span className="pill-dot" aria-hidden="true" />
            <span className="pill-bars" ref={barsRef} aria-hidden="true">
              <span /><span /><span /><span /><span /><span />
            </span>
            <span className="floating-pill-label">listening</span>
          </>
        )}

        {state === "polishing" && (
          <>
            <span className="pill-spinner" aria-hidden="true" />
            <span className="floating-pill-label">polishing…</span>
          </>
        )}

        {state === "done" && (
          <>
            <svg
              className="pill-check"
              viewBox="0 0 11 11"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 5.5 L4.5 8 L9 3"
                stroke="#5A8FE8"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="floating-pill-label floating-pill-label--done">
              copied
            </span>
          </>
        )}
      </button>
    </div>
  );
}
