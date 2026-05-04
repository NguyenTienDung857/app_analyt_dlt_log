# Agent Workflows

Use these workflows to keep edits complete and scoped.

## AI Default Or Context Change

1. Inspect `electron-main.js`, `renderer.js`, `index.html`, and `src/services/contextBuilder.js`.
2. Update persisted defaults in `electron-main.js`.
3. Update renderer fallbacks and UI defaults in `renderer.js`.
4. Update visible default options in `index.html`.
5. If saved configs must migrate, bump `AI_DEFAULTS_VERSION` and make normalization handle older values.
6. Keep row-level AI behavior aligned with `buildQuickAiContextMessages` and `buildQuickAiQuestion`.
7. Run `npm.cmd run syntax` and `npm.cmd run check`.

## Parser Or Large File Handling

1. Inspect `src/parser/dltParser.js` and `src/workers/parseWorker.js`.
2. Keep parsing deterministic and avoid UI-thread heavy work.
3. Add focused smoke coverage in `scripts/smoke-check.js` when behavior changes.
4. Run `npm.cmd run syntax` and `npm.cmd run check`.

## Renderer UI Change

1. Inspect `index.html`, `renderer.js`, and `style.css` together.
2. Preserve control IDs used by `renderer.js`.
3. Keep large lists scrollable inside bounded regions.
4. Avoid nested card layouts and keep operational screens dense and scannable.
5. Run `npm.cmd run syntax`.
6. Launch with `npm.cmd start` only when visual verification is needed.

## RAG Or Document Reading Change

1. Inspect `src/services/ragStore.js`, `src/services/docReader.js`, and `src/services/contextBuilder.js`.
2. Keep document parsing side-effect free where possible.
3. Extend `scripts/smoke-check.js` for new supported document behavior.
4. Run `npm.cmd run syntax` and `npm.cmd run check`.

## Release Or Packaging Change

1. Inspect `package.json`, `build.bat`, and Electron builder config.
2. Run `npm.cmd run syntax`.
3. Run `npm.cmd run check`.
4. Run `npm.cmd run pack` for an unpacked validation build.
5. Run `npm.cmd run dist` or `.\build.bat` only when installer output is required.

## Repo Admin Or GitHub Visibility Change

1. Inspect `git remote -v` and current branch state.
2. Prefer GitHub CLI for repo-admin actions when available.
3. Verify final state with a direct command, not only a successful exit code.
4. Do not change visibility, remotes, or branches without an explicit user request.

## Before Finishing Any Change

- Check `git status --short`.
- Report changed files and verification commands.
- Mention any checks that were not run.
- Do not revert unrelated local changes.
