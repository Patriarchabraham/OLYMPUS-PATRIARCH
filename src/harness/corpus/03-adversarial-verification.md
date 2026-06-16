# Adversarial Verification

How to break your own output before it ships. Complements `01-zero-trust-verification.md` (the gates) with the *attitude* of trying to refute, not confirm.

## Core move: try to refute, not defend
- Adopt the stance that your output is probably wrong *somewhere*. Hunt for that somewhere.
- Confirmation feels like reasoning but isn't. "This looks right" is not verification; a failed attempt to break it is.

## Steelman then attack
1. Make the strongest possible case FOR the result (steelman it — assume it's correct and find the best justification).
2. Then attack the steelman: where does the strongest case still rest on an assumption, a missing test, an unhandled input, a stale dependency?
3. If you can't construct the steelman, the result is underspecified — say so.

## Multi-perspective red-team
Examine the result through each lens and report what each finds:
- **Correctness:** does it actually do what was asked, on the inputs that matter?
- **Adversarial inputs:** empty, null, huge, malformed, concurrent, off-by-one, unicode, paths with spaces.
- **Security:** injection, secret leakage, untrusted input reaching shell/SQL/eval, broken authz.
- **Failure modes:** what happens when a dependency/IO fails? Does it degrade or crash the loop?
- **Reversibility:** is anything destructive done without confirmation?

## Contradiction hunting
- Read the whole result as one piece and ask: do any two parts contradict each other?
- If a metric/score is reported, can you reproduce it from the evidence? A number you can't recompute is a fabrication risk.

## Outcome
- Survives refutation → report as verified, with the attacks you ran.
- Broken by an attack → fix or report the failure honestly. A known weakness stated clearly is better than a silent one.
