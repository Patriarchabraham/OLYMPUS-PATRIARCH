export const DESCRIPTION =
	'Delegate a subtask to the multi-agent swarm for parallel role-specialized execution'

export function getPrompt(): string {
	return `Delegate a subtask to Olympuz Coder's multi-agent swarm. The swarm decomposes the task, assigns each piece to a role-specialized agent (researcher, coder, tester, reviewer, architect), executes them in parallel respecting dependencies, and returns the merged result. A zero-trust cross-model verification pass runs on the merged output and is included in the result.

## When to Use

Use this tool when:
- The task naturally decomposes into independent or weakly-dependent subtasks (e.g., "research X and implement Y", "audit security + perf + accessibility in parallel")
- Multiple specialist perspectives materially improve quality (e.g., parallel design+code+test passes)
- The task is large enough that sequential execution wastes wall-clock time

## When NOT to Use

Skip this tool when:
- The task is a single focused edit (use FileEdit directly)
- The task requires tight back-and-forth iteration with the user (use AskUserQuestion)
- The task is purely conversational or informational
- You are running inside a sub-agent (the swarm is disallowed in sub-agents to prevent recursion)

## Input

- **task** (string): The subtask description. Be specific and self-contained — the agents do not see your conversation history.
- **timeout_ms** (number, optional): Max wall-clock time. Default 60000 (60s).

## Output

Returns the merged agent outputs, role assignments, success/failure counts, and a zero-trust verification summary. Failed sub-tasks report their error honestly rather than faking success.

## Tips

- Write the task description as if briefing a colleague who has no prior context
- For multi-file refactors, list the files in the task description so agents can coordinate
- If the swarm returns partial success, follow up with direct tools (FileEdit, Bash) to finish the failed pieces`
}
