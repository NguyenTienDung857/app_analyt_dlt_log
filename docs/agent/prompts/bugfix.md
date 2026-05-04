# Bugfix Task Brief

Use this brief for defect fixes.

```text
You are working in D:\project\app_analyt_dlt_log.

Read AGENTS.md and docs/agent/README.md first.

Bug:
<describe observed behavior>

Expected:
<describe expected behavior>

Reproduction:
<steps, sample log, or screenshot details>

Constraints:
- Start by identifying the narrowest failing path.
- Do not rewrite unrelated UI or service code.
- If parser/RAG/document behavior changes, extend scripts/smoke-check.js.
- If AI behavior changes, read docs/agent/ai-behavior.md first.

Verification:
- Run npm.cmd run syntax.
- Run npm.cmd run check.
- Mention the exact behavior verified.
```
