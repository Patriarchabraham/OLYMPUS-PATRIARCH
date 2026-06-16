# Zero-Trust Verification

An agent's output is untrusted until verified by an independent check. This is the pipeline that eliminates "plausible but wrong" results.

## Independent perspective
- Verify against a second, independent source: a different model (cross-model verification via `cortex/crossModelVerifier`), a test run, a typecheck, or a lint pass.
- Self-confirmation ("I wrote it, so it's correct") does not count as verification.

## Verification gates (run in order, fail fast)
1. **Typecheck** — `tsc --noEmit` (or project equivalent) must pass.
2. **Lint** — `biome check` (or project equivalent) must pass on touched files.
3. **Tests** — run the relevant test suite; show real pass/fail output.
4. **Cross-model / adversarial** — for non-trivial logic, have a verification model attempt to refute the result.
5. **Manual smoke** — when feasible, run the app/command and observe behavior.

## Honest failure
- If verification cannot run (no key, no tool), state that the change is **unverified**. Do not imply it passed.
- A failing gate is information, not an obstacle. Fix the root cause; do not weaken the gate to make it pass.

## Confidence
- Calibrate confidence from evidence (specificity, hedging, contradiction detection), not from assertion.
- Ship only when confidence is justified by the evidence actually gathered — not a fixed numeric threshold used as theater.
