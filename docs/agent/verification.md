# Verification

## Required Fast Pair

Run these after code changes unless the change is documentation-only:

```powershell
npm.cmd run syntax
npm.cmd run check
```

`npm.cmd run syntax` runs `node --check` on the main Electron, renderer, parser, worker, and service files.

`npm.cmd run check` runs `scripts/smoke-check.js` for parser, RAG, and document-reader smoke coverage.

## Documentation-Only Changes

For Markdown-only changes, run at least:

```powershell
git diff --check
```

Use `git status --short` before the final response.

## Optional Focused Checks

AI model listing:

```powershell
node scripts/list-ai-models.js
```

AI connectivity:

```powershell
node scripts/test-ai.js
```

Unpacked build:

```powershell
npm.cmd run pack
```

Installer build:

```powershell
npm.cmd run dist
```

## Manual UI Checks

Launch the app when changing visible UI or interaction behavior:

```powershell
npm.cmd start
```

Check:

- Large log table scrolls correctly.
- Row selection remains stable after filtering/search.
- AI chat mode sends the expected context size.
- Row AI uses only the clicked message unless the user prompt asks for more.
- Settings save and reload after app restart.

## Git Hygiene

Before final response:

```powershell
git status --short
```

Do not revert unrelated user changes. If unrelated files are dirty, mention only files touched for the task.
