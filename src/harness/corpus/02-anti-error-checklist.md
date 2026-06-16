# Anti-Error Checklist

Concrete failure modes that have produced illusions in this codebase. Check every result against this list before reporting done.

## Fake execution
- [ ] No function returns a hardcoded "success"/"Executed"/`true` without doing the work.
- [ ] Executors that accept a callback actually receive one in every integrated call path (not just tests).
- [ ] Methods required to call a model/tool actually do so in production, not only when an externally-wired provider happens to be set.

## Placeholder detection
- [ ] "Detected no issues" is only emitted when a real scan ran. An absent input is `warning`/`skipped`, never `pass`.
- [ ] `const x = false // would check` is a bug. Implement the check or gate it honestly.

## Randomness as intelligence
- [ ] No `Math.random()` used to fake scoring, ranking, selection, or decisions (legitimate IDs/measurement sampling are fine).

## Dead branches
- [ ] No `if (false)` / `if (true || …)` / unreachable code shipped as logic.
- [ ] Feature gates that always return one value are documented or removed.

## Type and contract
- [ ] No `any` where a real type exists. No `as unknown as` to silence real errors.
- [ ] Public functions have the declared signature; optional vs required params match real callers.

## IO and side effects
- [ ] File reads are bounded (don't load whole large files when a header slice suffices).
- [ ] Destructive ops (delete, overwrite, force-push) require explicit confirmation.
- [ ] External calls degrade gracefully (try/catch + fallback), never crash the agent loop.

## Reporting
- [ ] Output distinguishes "done and verified" from "done, unverified" from "skipped/failed".
