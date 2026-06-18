# Meta-Cognition Doctrine (closed loop)

How the MetaCognitiveEngine works — and the honesty rules that separate it from prompt-only "consciousness" theater.

## What "real consciousness/depth" means here
Not a magic number. It is a **closed loop**: observe → reason → verify → evaluate → feed back → converge. The loop is real only if each stage's output changes a later stage. A meta-cognition that observes but never feeds back is decoration.

## The loop (every stage must feed a later one)
1. **Intent** (explicit/implicit/meta/predictive) → shapes the reasoning context.
2. **Pre-meta** (cortex: gaps, bias, complexity, calibrated confidence) → INJECTED into reasoning as constraints.
3. **Reason + escalate** (CoT→ToT→Self-Reflection→Ensemble on low confidence) → produces a chain.
4. **Meta-evaluate** (coherence, completeness, blind spots) → decides if another pass is needed.
5. **Converge** by re-reasoning on the blind spots, until a pass changes < epsilon. Convergence is MEASURED (conclusion similarity), not a fixed pass count.
6. **Verify** (cross-model agreement + contradictions) → gates the reported confidence.
7. **Calibrate** the final confidence from real signals (Bayesian + Dempster-Shafer fusion).
8. **Feed-forward** unresolved gaps/contradictions into the next turn.

## Confidence is reported, not asserted
- Show the components (cortex / reasoning quality / cross-model agreement) and their weighted aggregate. Never a single "0.997".
- If a component is unavailable (no API key, no verification model), say so and renormalize honestly — don't fabricate it.
- A confidence the user can't decompose is theater.

## Convergence, not iteration theater
- Re-reason only when meta-evaluation says a pass is needed AND there are blind spots.
- Stop when a pass produces < epsilon change (measured by text similarity) — that is genuine convergence.
- A bounded max-passes budget is a safety rail, not the goal. Hitting the max without converging is reported as "did NOT converge", never silently passed.

## Anti-patterns (the AILEX failure mode)
- Naming 12 "engines" / "343 pathways" / "Omega consciousness" that don't run.
- A confidence constant (0.997) with no measurement behind it.
- One-shot analysis stored and never fed back.
- "Auto" pipelines that add ceremony to every task regardless of stakes.
- Depth measured in passes/words rather than in issues caught and fixed.
