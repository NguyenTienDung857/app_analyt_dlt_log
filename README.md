# BLTN-Analysis Log (DLT + AI Diagnostics)

Ứng dụng desktop (Electron) để xem log DLT-style của Built-in Cam ECU và hỗ trợ phân tích lỗi bằng AI theo workflow timeline-first.

Mục tiêu thiết kế:
- Scan log nhanh trên timeline + log table gọn nhẹ.
- Dùng AI để phân tích có trọng tâm (dòng đang chọn, khoảng thời gian, hoặc view đang filter), kèm tài liệu ECU local (RAG).

## Chạy ứng dụng

```powershell
cd D:\project\app_analyt_dlt_log
npm.cmd install
npm.cmd start
```

Kiểm tra nhanh:

```powershell
npm.cmd run check
npm.cmd run syntax
```

## Build file cài đặt Windows

Chạy:

```powershell
.\build.bat
```

Script sẽ:
- Cài dependency nếu chưa có `node_modules`.
- Chạy `npm.cmd run syntax`.
- Chạy `npm.cmd run check`.
- Build installer Windows bằng `electron-builder`.

Kết quả nằm trong thư mục `dist`.

File quan trọng sau khi build:
- `BLTN-Analysis-Log-Setup-<version>.exe`: file cài đặt gửi cho người dùng.
- `latest.yml`: metadata để auto-update biết bản mới.
- `*.blockmap`: file hỗ trợ tải update hiệu quả hơn.

Build hiện đang tạo installer unsigned để dùng nội bộ. Nếu phát hành rộng, nên mua code-signing certificate và bật lại signing để Windows SmartScreen ít cảnh báo hơn.

## Auto update bằng GitHub Releases

App dùng `electron-updater` + `electron-builder` GitHub provider.

Cấu hình hiện tại trong `package.json`:

```json
"publish": [
  {
    "provider": "github",
    "owner": "NguyenTienDung857",
    "repo": "app_analyt_dlt_log"
  }
]
```

Quy trình phát hành bản update mới:
1. Tăng `version` trong `package.json` (ví dụ `1.0.0` -> `1.0.1`).
2. Chạy `build.bat`.
3. Vào GitHub repo `NguyenTienDung857/app_analyt_dlt_log`.
4. Tạo Release mới với tag trùng version, ví dụ `v1.0.1`.
5. Upload các file trong `dist` vào Assets của Release:
   - `BLTN-Analysis-Log-Setup-<version>.exe`
   - `latest.yml`
   - `*.blockmap`
6. Publish Release.
7. Khi người dùng mở app đã cài, app sẽ tự kiểm tra GitHub Releases, tải bản mới, rồi hỏi restart để cài.

Lưu ý:
- Repo nên là public nếu muốn app tự update mà không cần token trong máy người dùng.
- Installer đầu tiên đưa cho người dùng phải được build sau khi cấu hình GitHub provider đúng `owner/repo`.

Nếu muốn upload release bằng CLI thay vì kéo-thả thủ công:
1. Cài GitHub CLI (`gh`).
2. Login bằng `gh auth login`.
3. Chạy `build.bat`.
4. Tạo release bằng lệnh dạng:

```powershell
gh release create v1.0.1 dist\*.exe dist\*.blockmap dist\latest.yml --title "v1.0.1" --notes "Update release"
```

## Mở log

- Bấm `Open DLT / ENC` hoặc kéo-thả file vào màn hình đầu.
- Hỗ trợ mở nhiều file cùng lúc; parse chạy trong worker để UI không bị đơ.

Input dự kiến hỗ trợ: `.dlt`, `.enc`, `.log`, `.bin`.

Với file `.enc`, app tự giải mã bằng `DecryptDll.dll` ra một thư mục nằm cùng chỗ với file `.enc`, mở thư mục đó, rồi để người dùng chọn file `.dlt` cần parse.

## Log viewer

### Bảng log

Bảng log sử dụng virtual scrolling để xử lý file lớn.

Cột hiện tại:
- `#`: thứ tự message
- `Time`: mặc định hiện `HH:mm:ss` (tick checkbox bên cạnh `Time` để hiện full timestamp)
- `Delta`: độ trễ so với message trước
- `Payload`: nội dung payload (wrap dòng, row cao theo nội dung)

Có thể kéo vạch chia trên header để resize cột.

### Timeline / Minimap / Scroll

- `Minute Timeline` (phía trên): click để nhảy nhanh đến vùng thời gian tương ứng.
- `Minimap` (bên phải log list): click để nhảy nhanh đến vùng có cảnh báo/lỗi/AI highlight.
- Thanh cuộn dọc riêng (bên cạnh log list): rail nhỏ, kéo để di chuyển nhanh trong danh sách.

## Message Detail

Click vào 1 dòng log để xem:
- File
- Timestamp
- Payload đầy đủ

Lưu ý: dòng `Counter` đã được bỏ khỏi Message Detail (UI gọn hơn).

## Search / Filter

Panel bên trái:

- Ô search `Search payload or time... (F)` để tìm nhanh.
- `AI Search`: nhập câu hỏi tự nhiên và để AI chuyển thành filter plan local.
- `Time Range`: slider 2 đầu để giới hạn view theo `HH:mm:ss`.
  - Bấm `Full Log` để reset về toàn bộ log.
- `Export CSV`: xuất các dòng đang hiển thị (sau khi áp dụng search + range + AI Search filter).

Trong `Log AI Focus`, có thêm nút `Search` nhỏ ngay trên bảng log để quick search.

## AI Diagnostic Report

Dùng `Log AI Focus` để mở panel AI bên phải.

1. Nhập câu hỏi vào ô chat.
2. Chọn mode:
   - `Current line`: phân tích dòng đang chọn + context gần đó
   - `Range`: phân tích chỉ khoảng A-B của slider AI (Time/ID)
   - `Filtered`: phân tích view đang filter (context được rút gọn)
   - `Bug`: prompt kiểu whole-log để tìm vấn đề quan trọng nhất
3. Bấm `Send` (hoặc `Ctrl + Enter`).

Tính năng liên quan:
- Có thể chọn model theo từng lần `Send` bằng dropdown (nếu để `Config Default` thì dùng model trong AI config).
- Nút `Prompt` mở panel guidance để thêm yêu cầu trả lời (được lưu local).
- App gửi context rút gọn (chủ yếu time + payload) và kèm snippet tài liệu ECU (RAG) để kiểm soát token.

## Add ECU Docs / RAG

- Bấm `Add ECU Docs` để nạp tài liệu ECU local cho RAG.
- Hỗ trợ: `.txt`, `.log`, `.md`, `.xml`, `.arxml`, `.fibex`, `.docx`.
- `Docs: <chunks> chunks, <terms> terms` hiện trạng thái index.

## AI / RAG Config (locked)

Panel `AI / RAG Config` bị khóa mặc định và gồm:
- Base URL
- Default AI Model dropdown (lưu lại cho lần mở app sau)
- API key
- Extra headers JSON
- `Suggest context after opening logs`
- Context window (ms)
- Max AI messages (default 27,000)

## Download Guide

Nút `Download Guide` sẽ tải file hướng dẫn sử dụng (English) `USER_GUIDE_EN.md`.

## File quan trọng

- `electron-main.js`: main process, IPC, file dialog, export, ingest docs.
- `preload.js`: API bridge cho renderer.
- `index.html`: UI layout.
- `renderer.js`: UI logic (virtual scroll, timeline/minimap, filter, AI chat/report).
- `style.css`: theme va UI style.
- `src/parser/dltParser.js`: parse DLT/text.
- `src/workers/parseWorker.js`: worker parse.
- `src/services/aiClient.js`: client goi OpenAI-compatible API (proxy friendly).
- `src/services/contextBuilder.js`: build prompt + context + doc snippets.
- `src/services/ragStore.js`: RAG local store.
- `src/services/docReader.js`: doc reader (TXT/XML/DOCX).
