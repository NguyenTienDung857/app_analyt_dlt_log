# Agent Workspace Pack

This folder is the project-specific operating manual for coding agents. `AGENTS.md` remains the entry point that Codex reads first; this folder holds the deeper task playbooks.

## Fast Start

1. Read `AGENTS.md`.
2. Open `project-map.md` to locate the files for the requested task.
3. Use `workflows.md` for the correct edit path.
4. Run the verification from `verification.md`.
5. For AI behavior changes, always read `ai-behavior.md` before editing.

## Files

- `project-map.md`: repo layout, module ownership, and high-signal search targets.
- `workflows.md`: common implementation paths and commands.
- `ai-behavior.md`: current model defaults, context limits, prompt rules, and payload shape.
- `verification.md`: required fast checks and focused manual checks.
- `prompts/feature.md`: task brief for feature implementation.
- `prompts/bugfix.md`: task brief for defect fixes.
- `prompts/review.md`: task brief for code review.
- `prompts/release.md`: task brief for packaging/release validation.

## Codex vs Claude Code

Codex uses `AGENTS.md` plus any files it is asked to inspect. It does not require a large generated config tree.

Claude Code can use project slash commands and subagents. Those live in:

- `.claude/commands/`
- `.claude/agents/`

Keep these Markdown files synchronized with the guidance in this folder when workflows change.
