# Decomposition Patterns

How to break a task into milestones/subtasks suitable for parallel agent execution.

## When to decompose
- A task spans multiple files, multiple concerns, or has independent parts → decompose.
- A single, localized change → do not decompose; one task.

## How to decompose
- Split along **dependency boundaries**, not arbitrary line counts. Each subtask should be completable with minimal coupling to others.
- Express dependencies explicitly (task A blocks task B) so the orchestrator's topological sort can parallelize safely.
- Target 3–7 subtasks. Fewer risks coarse work; more risks coordination overhead.

## Ordering heuristics
1. **Understand before change** — research/read tasks come first and block implementation.
2. **Implement before verify** — coding tasks block testing tasks.
3. **Verify before merge** — review/verification tasks run last on the integrated result.

## Per-subtask contract
- Each subtask is a single, verifiable unit with a clear definition of done (see `11-output-contracts.md`).
- Each names the files it will touch, so parallel agents don't collide. When two subtasks must edit the same file, serialize them via a dependency.

## Failure isolation
- A failed subtask should not silently pass its dependents. The orchestrator gates dependents on predecessor success; respect that — do not fake a predecessor result to unblock.
