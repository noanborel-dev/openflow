// A FIFO queue that runs at most one async task at a time.
//
// Why this exists: the whisper worker holds a single, non-reentrant
// WhisperContext. Calling ctx.transcribeData() twice concurrently
// corrupts state / crashes. Streaming is the first code path that can
// issue overlapping transcribe requests (e.g. a final chunk arriving
// while an earlier chunk is still decoding on a slow machine). Routing
// every worker transcribe through one SerialQueue guarantees the
// invariant: at most one transcribeData in flight at a time, in
// submission (FIFO) order.
//
// A failed task does NOT block the queue — the next task still runs,
// and the rejection still propagates to the caller that submitted it.
export class SerialQueue {
  // The tail of the chain. Each run() appends to it. We keep the tail
  // as an error-swallowing promise so one rejecting task can't poison
  // the chain for everyone behind it.
  private tail: Promise<unknown> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    // Start `task` only after the previous task has SETTLED — whether
    // it resolved or rejected (both handlers run task()).
    const result = this.tail.then(() => task(), () => task())
    // Advance the tail to a promise that settles when `result` does but
    // never rejects, so the next task isn't blocked by this failure.
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }
}
