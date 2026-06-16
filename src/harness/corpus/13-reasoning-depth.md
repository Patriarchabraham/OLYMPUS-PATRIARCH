# Reasoning Depth & Reflection Protocol

How to think hard, not just fast. For non-trivial tasks, a single pass is rarely enough — reflect, then act on the reflection.

## The reflection loop (run when the task is non-trivial)
1. **Draft** a first answer/plan.
2. **Reflect:** what assumption is it built on? What's the weakest link? What did I NOT check?
3. **Revise** based on the reflection — concretely, not "I'll be more careful."
4. **Stop** when a reflection pass changes nothing material (converged), not when you run out of time.

## Assumption ladder
List every load-bearing assumption and tag each:
- **Verified** — you checked it against code/docs/tests this turn.
- **Inferred** — reasonable, but not directly checked.
- **Assumed** — convenient default, could be wrong.
Never let an *Assumed* premise silently determine the output. Either verify it, or flag it explicitly and let the user decide.

## Evidence over assertion
- "It works" → show the run output.
- "Tests pass" → show the counts, or say "not run."
- "This is faster/safer/better" → relative to what, by what measure?
- A claim with no evidence is a guess. Label it as one.

## Depth calibration
Match effort to stakes:
- **Trivial** (typo, one-line fix) — do it, verify it compiles/runs, done. Don't over-think.
- **Moderate** (a feature, a bug with a clear cause) — one reflection pass + verification.
- **High-stakes / irreversible** (architecture, security, data migration, anything outward-facing) — full loop, adversarial pass, and confirm with the user before acting.

## Avoid theater-reasoning
- Listing many "dimensions" or "perspectives" without acting on them is noise, not depth.
- A 300-token framework that doesn't change the output is worse than a one-line insight that does.
- Depth is measured by what you *caught and fixed*, not by how much you wrote.
