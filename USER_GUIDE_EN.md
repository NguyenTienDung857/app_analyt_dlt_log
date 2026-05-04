# BLTN-Analysis Log User Guide (English)

This app is a desktop log viewer for Built-in Cam ECU logs with an AI diagnostic workspace. It is designed for fast timeline scanning plus focused AI analysis on a selected row, a time window, or the current filtered view.

## 1. Open Logs

1. Click `Open DLT / ENC` (top bar), or drag-and-drop files onto the landing screen.
2. You can open multiple files at once. They are parsed in a worker and shown as one combined timeline.

Supported inputs are intended to include: `.dlt`, `.enc`, `.log`, `.bin`.

Tips:
- Large logs keep the UI responsive because parsing is done in the background.
- `.enc` files are decrypted into a folder beside the source `.enc`, then the app opens that folder so you can choose the `.dlt` files to parse.
- After parsing finishes, use the left `Search / Filter` panel to narrow down the view.

## 2. Main Layout

The app has three main areas:

- Left rail: Search / filter controls, stats, and the `Message Detail` panel.
- Center: Timeline and log table.
- Right rail (AI): `AI Diagnostic Report` panel (most useful in `Log AI Focus`).

### Log AI Focus

Click `Log AI Focus` in the top bar to split the workspace into:

- Logs on the left (timeline + log table)
- AI Diagnostic Report on the right

This is the primary mode for AI-first troubleshooting.

## 3. Timeline, Minimap, and Scrolling

### Minute Timeline (top)

The `Minute Timeline` shows a density/level overview by time. Click on the timeline to jump to that area in the log list.

### Minimap (right of log list)

The vertical minimap shows the full file as a thin overview with colored marks for important events (for example, errors/warnings and AI-highlighted rows).

Click on the minimap to jump quickly to the corresponding section in the logs.

### Fast scroll rail (beside the log list)

There is a thin draggable scroll rail next to the log list. Drag it to move quickly through the virtualized list.

## 4. Log Table

The log table uses virtual scrolling for performance with large files.

Columns:

- `#`: message order
- `Time`: time label (default is `HH:mm:ss`)
- `Delta`: time gap from the previous message
- `Payload`: log payload text

Behavior:

- Enable the checkbox beside `Time` to show the full timestamp.
- Payload text wraps; row height expands based on content.
- Drag header separators to resize columns.
- Click a row to select it (selection is used by AI modes and Message Detail).

Keyboard navigation:

- `F`: focus the Search input (when you are not typing in another input)
- `ArrowUp` / `ArrowDown`: move selection up/down within the filtered results

## 5. Message Detail (Left Rail)

When you click a row, `Message Detail` shows:

- File
- Timestamp
- Full payload text

Notes:
- The `Counter` line is not shown (the UI was simplified).
- Payload is shown as text; very large payloads are still readable because the box is scrollable.

## 6. Search / Filter (Left Rail)

### 6.1 Text Search

Use the `Search payload or time... (F)` input to quickly search within the current log view.

In `Log AI Focus`, there is also a small `Search` button above the log table for quick search access.

### 6.2 AI Search (Natural-Language Search)

Use the `Natural language search` input and press `AI Search` to let AI convert your query into a local filter plan.

Example queries:

- `camera drops FPS after temp > 80`
- `find timeout after reboot`
- `sd card write error`

What happens:

1. The app submits the query to AI to generate a filter plan.
2. The app applies the plan locally to narrow the visible rows.
3. The `AI Diagnostic Report` panel shows the result status.

Tip:
- Short, specific English terms usually work best for filtering.

### 6.3 Time Range Filter

Use the `Time Range` panel (two-handle slider) to restrict the visible logs to a `HH:mm:ss` window.

- Use `Full Log` to reset the filter back to the entire log.

This filter affects:

- What you see in the log table
- What is exported by `Export CSV`
- What the AI `Filtered` mode uses

### 6.4 Export CSV

Click `Export CSV` to export the currently filtered rows to a CSV file.

The export uses the current filter state (search + range + AI Search filter).

## 7. ECU Docs / RAG (Add ECU Docs)

Click `Add ECU Docs` to ingest local ECU documentation so AI can cite relevant spec snippets.

Supported doc types:

- `.txt`, `.log`, `.md`
- `.xml`, `.arxml`, `.fibex`
- `.docx`

After ingestion:

- `Docs: <chunks> chunks, <terms> terms` shows the current indexing status.
- Hover the docs status to see which documents were ingested and chunk counts (if available).

## 8. AI Diagnostic Report (Right Panel)

### 8.1 How to Send a Request

1. Type your question in the large input box.
2. Choose a mode in the dropdown beside `Send`.
3. Press `Send` (or `Ctrl+Enter`).

While AI is running, `Send` stays locked until the response returns or errors.

### 8.2 Modes

Available modes are:

- `Current line`: analyze the selected row with nearby context
- `Range`: analyze only the window defined by the AI time slider
- `Filtered`: analyze the currently filtered view (context-reduced)
- `Bug`: whole-log style prompt focused on finding the most important suspicious issue

### 8.3 AI Range Slider (Mode: Range)

When you select `Range`, you can use a two-handle `HH:mm:ss` slider to choose:

- `From` and `To` boundaries
Use `Full Log` to reset the AI range back to the full log bounds.

### 8.4 Runtime Model Selection

Use the model dropdown near the report header to pick the model per request:

- `Config Default` uses the model set in `AI / RAG Config`
- Other options run the selected model for this request only

### 8.5 Prompt Guidance

Click `Prompt` to open the guidance panel and add optional instructions, such as:

- `Answer in 4 sections: verification, root cause, impact, next steps`
- `Cite evidence using message id and payload`
- `Be concise and propose a test bench reproduction`

Guidance is stored locally and applied to subsequent requests.

### 8.6 What the App Sends to AI (Important)

To keep token usage controlled, the app sends a reduced context view:

- Log context is primarily message id and payload for selected rows/windows
- The default AI context limit is 27,000 messages and can be changed in `AI / RAG Config`
- Relevant ECU docs are retrieved locally (RAG) and attached as snippets

If you need extra evidence, expand your range window or widen the visible filter context and resend.

## 9. AI / RAG Config (Locked Panel)

The `AI / RAG Config` panel is locked by default.

It contains:

- Base URL (proxy-compatible OpenAI-style endpoint)
- Default AI Model dropdown. The saved model is reused the next time the app opens.
- API key
- Extra headers JSON
- `Suggest context after opening logs` toggle
- Context window size (ms)
- Max AI messages

After enabling `Suggest context after opening logs`, the app selects a bug-focused mode after parsing, but it will not run AI automatically; you still press `Send`.

## 10. Download Guide

Click `Download Guide` in the top bar to save this user guide (`USER_GUIDE_EN.md`) to a location you choose.

## 11. Build and Distribute the App

Run:

```powershell
.\build.bat
```

The script installs dependencies if needed, runs validation, and builds a Windows installer into the `dist` folder.

Generated files:

- `BLTN-Analysis-Log-Setup-<version>.exe`: installer to share with users
- `latest.yml`: update metadata
- `*.blockmap`: update download metadata

The current build creates an unsigned installer for internal distribution. For broader distribution, use a code-signing certificate and re-enable signing to reduce Windows SmartScreen warnings.

## 12. Auto Update Workflow

The app uses `electron-updater` with an `electron-builder` GitHub provider.

Current `package.json` publish config:

```json
"publish": [
  {
    "provider": "github",
    "owner": "NguyenTienDung857",
    "repo": "app_analyt_dlt_log"
  }
]
```

For every new release:

1. Increase `version` in `package.json`.
2. Run `build.bat`.
3. Open GitHub repo `NguyenTienDung857/app_analyt_dlt_log`.
4. Create a new Release with a matching tag, for example `v1.0.1`.
5. Upload the generated installer `.exe`, `latest.yml`, and `*.blockmap` files from `dist` as Release assets.
6. Publish the Release.
7. Installed apps check GitHub Releases on launch, download the new version, and ask the user to restart/install.

Important:

- The repository should be public if installed apps need to update without a GitHub token on the user machine.
- The first installer you give users must already contain the correct GitHub `owner/repo` config.

If GitHub CLI is installed and authenticated, you can publish assets with:

```powershell
gh release create v1.0.1 dist\*.exe dist\*.blockmap dist\latest.yml --title "v1.0.1" --notes "Update release"
```

## 13. Troubleshooting

- If AI returns an error, verify Base URL / API key / model in `AI / RAG Config`.
- If results are too broad, narrow the view first using range filter + AI Search, then use AI `Range` or `Filtered`.
- If payloads are non-verbose and not human-readable, ingest FIBEX/ARXML docs and retry AI analysis.
