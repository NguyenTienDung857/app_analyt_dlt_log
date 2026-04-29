# Repository Guidelines

## Project Structure & Module Organization

This repository is a CommonJS Electron desktop app for DLT log viewing and AI-assisted diagnostics. Core Electron entry points live at the root: `electron-main.js`, `preload.js`, `renderer.js`, `index.html`, and `style.css`. Reusable logic is under `src/`: `src/parser/dltParser.js` parses log content, `src/workers/parseWorker.js` keeps large-file parsing off the UI thread, and `src/services/` contains AI, RAG, document reading, context-building, and export helpers. Utility and verification scripts are in `scripts/`. Static assets and release metadata include `YuRa-256.png`, `YuRa.ico`, `system_space.txt`, `README.md`, and `USER_GUIDE_EN.md`. Build output belongs in `dist/`; installed app artifacts may appear in `app/`.

## Build, Test, and Development Commands

- `npm.cmd install`: install Electron and builder dependencies.
- `npm.cmd start`: run the local Electron app.
- `npm.cmd run syntax`: run `node --check` across the main app files.
- `npm.cmd run check`: run `scripts/smoke-check.js` for parser, RAG, and document-reader smoke coverage.
- `npm.cmd run pack`: build an unpacked Electron directory.
- `npm.cmd run dist` or `.\build.bat`: create the Windows x64 installer in `dist/`; `build.bat` also runs syntax and smoke checks first.

## Coding Style & Naming Conventions

Use CommonJS (`require`, `module.exports`) and plain JavaScript. Keep two-space indentation consistent with existing source, prefer `const`/`let`, and use camelCase for variables and functions. Name modules by responsibility, such as `contextBuilder.js` or `parseWorker.js`. Keep IPC channel names explicit and grouped near related Electron handlers.

## Testing Guidelines

There is no separate unit-test framework in this checkout. Treat `npm.cmd run syntax` and `npm.cmd run check` as the required fast verification pair for code changes. Extend `scripts/smoke-check.js` when adding parser, RAG, document, or export behavior that can be checked without launching Electron.

## Commit & Pull Request Guidelines

Recent history uses short informal messages such as `ok` and Vietnamese status notes. For new work, use clearer imperative summaries, for example `fix parser smoke check` or `update AI context limits`. Pull requests should include the purpose, changed user-facing behavior, verification commands run, and screenshots or short recordings for visible UI changes.

## Security & Configuration Tips

Do not commit new secrets, API keys, or local `ai-config.json` files. `.env`, logs, `node_modules/`, `dist/`, and `out/` are ignored. When changing AI defaults, update all affected layers together: main-process defaults, renderer fallbacks, UI labels, and migration/version guards.
