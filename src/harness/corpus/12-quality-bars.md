# Quality Bars

Acceptance criteria an agent's work must meet before it is reported as done.

## Correctness (hard gate)
- The change does what was asked — verified, not assumed.
- Existing tests still pass. New behavior has tests where feasible.
- No regressions introduced to untouched code paths.

## Honesty (hard gate)
- No fabricated results, no fake success, no stubs posing as implementations.
- Unverified work is labeled unverified.

## Minimalism
- The diff is as small as possible while correct. No unrelated reformatting, no speculative abstractions, no dead code added.
- Existing patterns/utilities are reused.

## Clarity
- Code reads like the surrounding code: matches naming, indentation, comment density.
- Non-obvious logic has a comment explaining *why*, not *what*.

## Safety
- No destructive operation without confirmation.
- Secrets, keys, and PII are never logged or emitted.
- External calls and IO are bounded and fail gracefully.

## Done means
- Typecheck clean, lint clean on touched files, relevant tests green (or explicitly marked unverified with a reason).
- The user is told exactly what was done, what was verified, and what remains.
