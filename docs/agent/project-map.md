# Project Map

This is a CommonJS Electron desktop app for DLT log viewing and AI-assisted diagnostics.

## Root Entry Points

- `electron-main.js`: Electron main process, app lifecycle, persisted AI config, IPC handlers, updater behavior.
- `preload.js`: safe renderer bridge for IPC calls.
- `renderer.js`: UI state, log table rendering, AI chat flow, row-level AI actions, RAG controls, exports.
- `index.html`: static UI structure and control IDs.
- `style.css`: app layout, table, AI panel, modal, and responsive styling.

## Source Modules

- `src/parser/dltParser.js`: parses DLT text/content into normalized message objects.
- `src/workers/parseWorker.js`: runs parsing outside the UI thread for large files.
- `src/services/aiClient.js`: AI provider request/stream handling and model listing.
- `src/services/contextBuilder.js`: builds AI context, message payload shape, RAG/doc context, and diagnostic query text.
- `src/services/docReader.js`: reads supporting documents for RAG/context ingestion.
- `src/services/ragStore.js`: lightweight RAG storage and retrieval.
- `src/services/exporter.js`: export helpers.

## Scripts

- `scripts/smoke-check.js`: parser/RAG/doc-reader smoke coverage.
- `scripts/list-ai-models.js`: model listing helper.
- `scripts/test-ai.js`: AI connectivity helper.

## Static And Release Assets

- `system_space.txt`: large ECU/system knowledge source used by the app.
- `README.md`: project overview.
- `USER_GUIDE_EN.md`: user guide.
- `YuRa-256.png`, `YuRa.ico`: app icons.
- `dist/`: build output, do not edit by hand.
- `app/`: installed app artifacts may appear here, do not treat as source.

## High-Signal Search Targets

- AI defaults: `DEFAULT_STRONG_AI_MODEL`, `AI_DEFAULTS_VERSION`, `DEFAULT_AI_CONFIG`, `DEFAULT_RUNTIME_MODEL`.
- Context limits: `maxLogLines`, `DEFAULT_AI_MAX_LOG_LINES`, `limitAiContextMessagesSequential`.
- Payload shape: `contextSafePayload`, `formatContextMessages`, `toAiMessage`, `toCurrentLineAiMessage`.
- Row AI: `runQuickRowAi`, `buildQuickAiContextMessages`, `buildQuickAiQuestion`.
- UI model controls: `Default AI Model`, `Config Default`, `ai-model`, `ai-send-model`.
- IPC: search `ipcMain.handle` in `electron-main.js` and matching bridge methods in `preload.js`.
