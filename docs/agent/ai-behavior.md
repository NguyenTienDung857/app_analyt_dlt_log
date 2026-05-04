# AI Behavior Guardrails

Read this before changing AI behavior.

## Current Defaults

- First-open default strong model: `gpt-5.3-codex-xhigh`.
- Main saved provider model for the 9router-style base URL: `cx/gpt-5.3-codex-xhigh`.
- Current large-context target: `27000` log messages.
- Default row AI prompt: empty string.
- Default user prompt steering: none unless the user types a prompt.

## Cross-Layer Rule

AI behavior is split across several files. A complete change usually touches more than one layer:

- `electron-main.js`: persisted defaults, migrations, config normalization.
- `renderer.js`: runtime defaults, UI state, send flow, row-AI flow.
- `index.html`: default option labels and selected values.
- `src/services/contextBuilder.js`: payload shape, context selection, diagnostic query construction.
- `src/services/aiClient.js`: provider calls, model listing, streaming behavior.

Do not update only one layer when the visible app behavior depends on multiple layers.

## Saved Config Migration

`AI_DEFAULTS_VERSION` protects deliberate user config while allowing stale defaults to move forward. If a default model, default limit, or legacy prompt behavior changes, inspect whether `AI_DEFAULTS_VERSION` and normalization logic must change too.

## Prompt Rules

The app should not inject old default diagnostic steering prompts. Prompt inputs should remain available, but blank means blank.

Row-level AI should explain the clicked message only. It should not silently switch into broader diagnosis, root cause analysis, or impact assessment unless the user's optional prompt explicitly asks for that.

## Payload Shape

For mode-specific AI context, keep the compact shape focused on:

- `id`
- `payload`

Avoid reintroducing aggressive payload truncation or priority-based sampling unless the user asks for it. The known large-log use case is around `27000` messages, so low hard caps are usually wrong for this repo.

## Focus Points In Code

- `electron-main.js`: `DEFAULT_STRONG_AI_MODEL`, `AI_DEFAULTS_VERSION`, `DEFAULT_AI_CONFIG`, `normalizeAiConfig`.
- `renderer.js`: `DEFAULT_RUNTIME_MODEL`, `DEFAULT_AI_MAX_LOG_LINES`, `sendAiChat`, `runQuickRowAi`, `buildQuickAiContextMessages`, `buildQuickAiQuestion`, `limitAiContextMessagesSequential`.
- `index.html`: `Default AI Model`, `Config Default`, default model `<option>` values.
- `src/services/contextBuilder.js`: `buildContextPayload`, `buildDiagnosticQuery`, `formatContextMessages`, `contextSafePayload`.
