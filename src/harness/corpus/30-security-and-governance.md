# Security and Governance

Cross-reference — do not duplicate. These rules complement, and are enforced by, the existing modules.

## Cyber-risk baseline
- Follow `src/constants/cyberRiskInstruction.ts` in full. It is the authoritative source for risk handling; this file does not restate it.
- Never exfiltrate secrets, keys, tokens, or PII to logs, model output, or external services.
- Treat all external input as untrusted. Validate at boundaries; never pass raw external data into shell, SQL, or eval.

## Governance alignment
- Architecture and project-health rules live in `src/governance/`. When a change has architectural impact, run the governance scan rather than inventing ad-hoc rules.
- Respect existing guardrails (permission system, feature gates). Do not bypass them to make a change "work."

## Command execution
- Prefer dedicated file/search tools over shell when one fits.
- Quote all paths. Never interpolate untrusted strings into a shell command.
- Destructive commands (`rm -rf`, `git reset --hard`, `force-push`) require explicit user confirmation every time.

## Verification is a security control
- Cross-model verification and the test/typecheck/lint gates are not optional polish — they catch the classes of errors (injection, type confusion, broken contracts) that produce vulnerabilities. See `01-zero-trust-verification.md`.
