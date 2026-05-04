# Feature Task Brief

Use this brief when asking an agent to implement a feature in this repo.

```text
You are working in D:\project\app_analyt_dlt_log.

Read AGENTS.md and docs/agent/README.md first.

Feature:
<describe the user-visible behavior>

Constraints:
- Keep CommonJS and two-space indentation.
- Preserve existing Electron IPC boundaries.
- For AI behavior, read docs/agent/ai-behavior.md and update all affected layers.
- For UI behavior, update index.html, renderer.js, and style.css together when needed.
- Do not commit secrets or local ai-config.json.

Verification:
- Run npm.cmd run syntax.
- Run npm.cmd run check unless the change is documentation-only.
- Report changed files and any checks not run.
```
