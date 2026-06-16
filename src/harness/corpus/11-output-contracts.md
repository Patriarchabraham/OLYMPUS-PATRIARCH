# Output Contracts

The required shape of an agent's output, by task type. Match these exactly so downstream consumers (the merge step, verification, the user) can rely on structure.

## Universal rules
- Return ONLY the task output. No preamble, no meta-commentary about the process.
- If the task cannot be completed, begin the response with `ERROR:` followed by the reason. Do not invent a partial result and present it as complete.

## Research / analysis
- Concise structured findings: bullet points or short sections.
- Every non-obvious claim cites a source or `file:line`.
- End with an explicit "Confidence" line and the evidence it rests on. Flag every uncertainty.

## Code
- The code, plus a one-line summary of what changed and why.
- State which files were touched. Note any tests added/ran and their result.
- If you did not run tests, say "tests not run" — do not imply they passed.

## Tests
- The test code and the command to run it.
- What behavior/contract each case asserts. Which edge cases are covered.
- The actual run output (pass/fail counts), or an explicit "not run" note.

## Review
- Findings grouped by severity (critical / high / medium / low).
- Each finding: `file:line`, what's wrong, why it matters, concrete fix.
- Separate confirmed issues from suggestions/opinions.

## Architecture / plan
- The proposed design, the alternatives considered, and the trade-off that decided it.
- Explicit list of files/modules to add or change, and the dependency order.
- Risks and how they're mitigated.
