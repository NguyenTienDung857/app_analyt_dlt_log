# BLTN-Analysis Log User Guide (English)

This app is a desktop log viewer for Built-in Cam ECU logs with an AI diagnostic workspace. It is designed for fast timeline scanning plus focused AI analysis on a selected row or the current filtered view.

## 1. Open Logs

1. Click `Open DLT / ENC` (top bar), or drag-and-drop files onto the landing screen.
2. You can open multiple files at once. They are parsed in a worker and shown as one combined timeline.

Supported inputs are intended to include: `.dlt`, `.enc`, `.log`, `.bin`.

Tips:
- Large logs keep the UI responsive because parsing is done in the background.
- `.enc` files are decrypted into the app data folder, then the app opens that extracted folder so you can choose the `.dlt` files to parse. This is more reliable for files stored on SD cards or removable drives.
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

### 6.2 Keyword Navigation

Click `+` beside the main search input to add another keyword search box. Each search box has its own match counter and up/down buttons.

`Full` is enabled by default. All active searches highlight matches while keeping the current log view visible. Turn `Full` off to show rows that match any active keyword search.

Use the up/down buttons beside each counter to move between matches for that search box. Extra search boxes have `x` to remove them.

### 6.3 ID Range Filter

Use the `ID Range` panel (two-handle slider) to restrict the visible logs by message ID. Each ID label also includes the matching time, so there is no separate Time Range mode.

Time labels include a day marker such as `D1` or `D2` so multi-day logs stay clear.

- Use `Full Log` to reset the filter back to the entire log.

This filter affects:

- What you see in the log table
- What is exported by `Export CSV`
- What the AI `All current line` mode uses

### 6.4 Export CSV

Click `Export CSV` to export the currently filtered rows to a CSV file.

The export uses the current filter state (search + range).

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
- `All current line`: analyze the currently filtered view (context-reduced)

### 8.3 Runtime Model Selection

Use the model dropdown near the report header to pick the model per request:

- `Config Default` uses the model set in `AI / RAG Config`
- Other options run the selected model for this request only

### 8.4 Prompt Guidance

Click `Prompt` to open the guidance panel and add optional instructions, such as:

- `Answer in 4 sections: verification, root cause, impact, next steps`
- `Cite evidence using message id, time, and payload`
- `Be concise and propose a test bench reproduction`

Guidance is stored locally and applied to subsequent requests.

### 8.5 What the App Sends to AI (Important)

To keep token usage controlled, the app sends a reduced context view:

- Log context is primarily message id, `HH:mm:ss` time, and payload for the selected row context or current filtered view
- The default AI context limit is 27,000 messages and can be changed in `AI / RAG Config`
- Relevant ECU docs are retrieved locally (RAG) and attached as snippets

If you need extra evidence, widen the visible filter context and resend.

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

After enabling `Suggest context after opening logs`, the app selects `All current line` after parsing, but it will not run AI automatically; you still press `Send`.

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
- If results are too broad, narrow the view first using search and the ID Range filter, then use AI `All current line`.
- If payloads are non-verbose and not human-readable, ingest FIBEX/ARXML docs and retry AI analysis.
