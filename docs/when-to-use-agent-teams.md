# When to use Agent Teams (and when not to)

A decision guide for Claude Code parallel-execution options. Pick the right tool before reaching for the biggest one.

## TL;DR — Decision tree

```
Need parallelism?
├── No  → single session
└── Yes
    ├── Workers need to message each other or debate?
    │   └── Yes → Agent Teams
    ├── Workers just need to run independently and report back?
    │   └── Yes → Subagents (Agent tool)
    └── Want full isolation per branch (separate cwd, separate file state)?
        └── Yes → Git worktrees
```

If you can't articulate why teammates need to talk to each other, you don't need Agent Teams. Use subagents.

## Side-by-side comparison

| Capability                        | Subagents              | Agent Teams                                | Git worktrees       |
| --------------------------------- | ---------------------- | ------------------------------------------ | ------------------- |
| Parallel execution                | Yes                    | Yes                                        | Yes (manual)        |
| Independent context per worker    | Yes                    | Yes                                        | Yes                 |
| Workers message each other        | No                     | Yes (`SendMessage`)                        | No                  |
| Shared task list with self-claim  | No                     | Yes                                        | No                  |
| Human can talk to one worker      | No                     | Yes (`Shift+Down`)                         | Yes (separate CLI)  |
| Token cost                        | Lower                  | Higher (each teammate = full Claude)       | Same as N sessions  |
| Coordination overhead             | Minimal                | Real (mailbox, task list, idle protocol)   | None (you coordinate)|
| Setup                             | None                   | One-time env-var + `TeamCreate`            | `git worktree add`  |
| Cleanup                           | Automatic              | Manual (`TeamDelete` or "clean up team")   | Manual              |
| Filesystem isolation              | No (shared cwd)        | No (shared cwd)                            | Yes (own cwd)       |
| Session resumption (`/resume`)    | N/A                    | Broken for in-process teammates            | Yes                 |

## Use Agent Teams when…

- **Debate / adversarial reasoning is the point.** "Investigate 5 hypotheses and have them try to disprove each other" — the debate is the mechanism. Anchoring bias from a single investigator is what you're fighting.
- **Workers genuinely need to share intermediate findings.** Security reviewer needs to ask the performance reviewer "does your optimization affect the input-validation path?" mid-flight.
- **You want to steer one worker directly without going through a coordinator.** `Shift+Down` to that teammate's pane, redirect them, return to the lead. Subagents can't do this — they're sealed black boxes that return one result.
- **Long-running independent tracks that produce intermediate artifacts.** Each teammate owns a module for an hour; the shared task list keeps them out of each other's way.
- **You want a persistent coordinator.** The lead stays alive across multiple rounds of work, can re-message the same teammate by name, can spawn replacements when one fails.

## Use Subagents when…

- **The result is what matters, not the process.** "Count TS files under src/" — one number back. The agent doesn't need to talk to anyone.
- **Map-reduce shape.** Three independent reads, three independent answers, parent synthesizes. No cross-talk needed.
- **Cheap and disposable.** Subagent exits when done. No cleanup, no token cost for staying alive between turns.
- **The work is tightly scoped and the failure mode is "retry with a different prompt."** Cheaper than spinning a team for a 10-second task.

## Use Git worktrees when…

- **Two changes must not see each other's filesystem.** Refactor A on branch-a, refactor B on branch-b, neither knows the other exists.
- **You want full editor/CLI isolation.** Open separate `claude` sessions in separate worktrees; they can't accidentally edit the same file.
- **You explicitly do NOT want a coordinator.** You'll merge later, by hand or by PR.

## Anti-patterns — don't do these

### "Use a team for a refactor split across three files"
If the three files don't depend on each other and the agents don't need to negotiate, **subagents are correct** — three `Agent` calls in parallel, parent integrates. Forcing `TeamCreate` adds mailbox overhead and idle-protocol ceremony for no benefit.

### "Use a team to parallelize a sequential pipeline"
If task B depends on task A's output, the team buys nothing — task B sits idle waiting on A. Just do it sequentially in one session.

### "Spin up 8 teammates"
The docs cap recommended size at 3–5 for a reason. Coordination overhead grows faster than parallel throughput. Three focused teammates often beat five scattered ones.

### "Have two teammates edit the same file"
File conflicts. Last write wins. Split by file ownership, not by feature area.

### "Use a team because the task is complex"
Complexity ≠ parallelism. A complex single-threaded task (debug a race condition) is still single-threaded. Teams help when work is independent, not when it's hard.

### "Persist a team across days"
Teams don't survive `/resume` cleanly. They're for the duration of a work session, not as durable state. Spin up, do the work, tear down.

## Hard limits to remember

- **Experimental flag required**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in env or settings. Process must start with the flag set — restarting is the only fix for stale sessions.
- **Claude Code v2.1.32+** required.
- **One team per lead at a time.** Clean up before starting another.
- **No nested teams.** Teammates can't spawn their own teams.
- **Lead is fixed for the team's lifetime.** Can't promote a teammate to lead.
- **Split-pane mode requires tmux or iTerm2 + `it2` CLI.** In-process mode (default in any terminal) works everywhere but lacks visible-at-once panes.
- **Token cost scales linearly.** Each teammate is a separate Claude instance with its own context window.

## How to actually use it (5-second version)

In a fresh `claude` session with the env var set:

```
Create a team called "demo" with two teammates: "alice" and "bob" (general-purpose).
Have them debate whether we should rewrite this module or refactor in place.
```

- `Shift+Down` → cycle to next teammate's pane. Type to message them directly.
- `Ctrl+T` → toggle shared task list.
- `Escape` → interrupt a busy teammate.
- When done: tell the lead `clean up the team`.

## Quick self-check before reaching for a team

1. Can I name the message my teammates need to exchange? If not → subagents.
2. Will the cost of N parallel Claude instances pay for itself in wall-clock time saved? If not → single session.
3. Do I actually want to talk to individual workers, or just collect their final outputs? Latter → subagents.
4. Is there any sequential dependency between the workers? Yes → either sequence them, or split the truly-parallel part out.

If you answer "no" to all four, you don't need Agent Teams.
