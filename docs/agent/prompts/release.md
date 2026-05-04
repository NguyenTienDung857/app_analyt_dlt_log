# Release Task Brief

Use this brief for packaging or release validation.

```text
You are preparing D:\project\app_analyt_dlt_log for release.

Read AGENTS.md and docs/agent/verification.md first.

Release target:
<version, installer, unpacked build, or GitHub release>

Checklist:
- Inspect package.json build config.
- Run npm.cmd run syntax.
- Run npm.cmd run check.
- Run npm.cmd run pack for unpacked validation.
- Run npm.cmd run dist or .\build.bat only if installer output is needed.
- Verify dist/ output names and do not edit generated artifacts manually.

Output:
- Commands run.
- Build artifacts produced.
- Any warnings or skipped checks.
```
