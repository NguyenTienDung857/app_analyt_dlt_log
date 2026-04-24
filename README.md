# NEXUS DLT AI Workbench

Ứng dụng desktop đọc log `.dlt`, `.log`, `.bin`, `.txt` của Built-in Cam ECU, ưu tiên workflow AI-first để tìm lỗi, phân tích nguyên nhân gốc và đối chiếu tài liệu ECU local.

Tài liệu ECU mặc định hiện dùng: `system_space.txt`.

## 1. Chạy ứng dụng

```powershell
cd D:\app\DltViewerSDK\dlt-web-viewer
npm.cmd start
```

Nếu chạy trên máy mới chưa có dependency:

```powershell
npm.cmd install
npm.cmd start
```

Kiểm tra nhanh:

```powershell
npm.cmd run check
npm.cmd run syntax
```

## 2. Tài liệu ECU / RAG

Khi khởi động, app tự index tài liệu ECU theo thứ tự ưu tiên:

1. `system_space.txt`
2. `system_space.docx`
3. `system_space`
4. `01_System_Spec_BLTN_CAM_v2_2(20250602).docx` nếu tồn tại

Nút `Add ECU Docs` cho phép nạp thêm:

- `.txt`
- `.md`
- `.log`
- `.xml`
- `.arxml`
- `.fibex`
- `.docx`

Khi AI phân tích hoặc chat, app tự tìm các đoạn tài liệu ECU liên quan bằng RAG và gửi kèm vào prompt.

## 3. Mở log

Có 2 cách:

1. Bấm `Open DLT`.
2. Kéo thả file vào màn hình mở file.

Hỗ trợ mở nhiều file cùng lúc. Khi parse, app hiển thị tiến trình, tên file, dung lượng, số message đã load và thời gian parse.

## 4. AI Workbench

Đây là vùng chính của app.

Chức năng:

- Chat trực tiếp với AI bằng ô nhập lớn.
- `Ctrl + Enter`: gửi chat.
- `Chat với dòng chọn`: gửi message đang chọn và context trước/sau.
- `Chat với filter hiện tại`: gửi các dòng đang được filter.
- `Chat với lỗi nghi ngờ`: gửi cụm Error/Fatal/Warn/keyword nghi ngờ.

Khi chat, app gửi kèm:

- Câu hỏi của bạn.
- Context log đang chọn/lọc/nghi ngờ.
- Thống kê session log.
- Tài liệu ECU liên quan từ `system_space.txt`.

AI được yêu cầu trả lời bằng tiếng Việt, nêu bằng chứng message id, giả thuyết nguyên nhân và bước kiểm tra tiếp theo.

## 5. Các nút ẩn/hiện giao diện

- `Session`: ẩn/hiện cột file, thống kê, cấu hình AI/RAG.
- `Filter`: ẩn/hiện vùng search/filter.
- `Detail`: ẩn/hiện cột detail bên phải.
- `AI Focus`: chuyển giao diện sang chế độ ưu tiên AI, ẩn vùng phụ.

## 6. Dashboard

Cột bên trái hiển thị:

- `Total`: tổng message.
- `Filtered`: số message sau filter.
- `Error/Fatal`: tổng lỗi nghiêm trọng.
- `Warning`: tổng cảnh báo.
- `ECU`: số ECU khác nhau.
- `Span`: khoảng thời gian log.
- `Level Distribution`: phân bố level.

## 7. Timeline và Minimap

Timeline dùng màu:

- Xanh dương: normal/info.
- Vàng: warning.
- Đỏ: error/fatal.
- Xanh cyan: message AI đánh dấu nghi ngờ.

Click timeline hoặc minimap để nhảy nhanh đến vùng log tương ứng.

## 8. Bảng log

Bảng log dùng virtual scrolling, phù hợp file lớn.

Cột chính:

- `Mark`
- `#`
- `Time`
- `Delta`
- `Level`
- `Type`
- `ECU`
- `APID`
- `CTID`
- `Payload`
- `Len`

Click một dòng để xem detail. Click `Mark` để bookmark.

## 9. Search và Filter

Search thường hỗ trợ:

- Payload
- ECU/APID/CTID
- Level
- Type
- File
- Case-sensitive
- Regex

Filter thời gian:

- `From`
- `To`
- `Marked`

Export:

- `Export CSV`
- `Export JSON`

## 10. Natural Language Search

Ô `Natural language search` dùng để hỏi kiểu tự nhiên.

Ví dụ:

```text
Tìm những lúc camera bị rớt frame sau khi nhiệt độ vượt quá 80 độ
```

App sẽ:

- Gọi AI để chuyển câu hỏi thành filter.
- Nếu AI trả filter rỗng, app tự fallback bằng bộ phân tích local.
- Tự nhận diện các concept như camera/frame/FPS, nhiệt độ, voltage, timeout, DTC/UDS, SD/storage, PMD, reset, CAN/Ethernet/SOMEIP.
- Hiển thị số dòng match trong `AI Diagnostic Report`.

## 11. AI Analyze Row

Dùng khi thấy một dòng nghi ngờ.

Quy trình:

1. Click dòng cần phân tích.
2. Bấm `Analyze Row`.
3. App lấy context quanh dòng đó.
4. App gửi log context + RAG tài liệu ECU cho AI.
5. AI trả report tiếng Việt.
6. `suspicious_message_ids` được highlight và bookmark.

## 12. AI Analyze Range A-B

Dùng khi lỗi kéo dài trong một khoảng thời gian.

Quy trình:

1. Nhập `Range A`.
2. Nhập `Range B`.
3. Bấm `AI A-B`.

App gửi các message trong khoảng A-B và context trước/sau cho AI.

## 13. AI Auto Scan

Nút `Run AI Auto Scan` dùng để quét nhanh log.

App sẽ:

- Tìm cụm `Error/Fatal`.
- Nếu không có, tìm `Warn` và keyword nghi ngờ như `timeout`, `fail`, `dtc`, `reset`, `fps`, `voltage`, `temperature`, `camera`, `sd`, `pmd`.
- Gửi context cho AI để tạo báo cáo tổng thể.
- Highlight/bookmark message nghi ngờ.

## 14. Sequence Diagram

Nút `Sequence` gửi range A-B cho AI để sinh Mermaid sequence diagram.

Kết quả hiển thị trong report dạng JSON có:

- `summary`
- `mermaid`
- `participants`
- `suspicious_message_ids`

Hiện app hiển thị Mermaid code, chưa render trực tiếp thành hình.

## 15. Test Script

Nút `Test Script` yêu cầu AI tạo script tái hiện lỗi trên bàn test.

Nếu thiếu thông tin CAPL, AI ưu tiên Python pseudo-code an toàn.

## 16. Signal Plot

Nút `Plot First Numeric Signal`:

1. Chọn message có payload chứa số.
2. App tìm các message cùng ECU/APID/CTID.
3. Lấy số đầu tiên trong payload.
4. Vẽ line chart theo thời gian.

Phù hợp với temperature, voltage, FPS, counter, state numeric.

## 17. Diff 2 file log

Khi mở từ 2 file trở lên, app tính diff signature cơ bản giữa 2 file đầu tiên.

Signature gồm:

- Level
- ECU
- APID
- CTID
- Payload đã normalize số thành `#`

## 18. DLT Non-Verbose và FIBEX/ARXML

Với DLT verbose, app decode cơ bản string/raw/bool/uint/sint/float.

Với DLT non-verbose:

- App hiển thị message id và payload non-verbose.
- App không ép AI đọc raw hex như text.
- Muốn decode đúng cần nạp FIBEX/ARXML.

## 19. Cấu hình AI

Mặc định:

- Base URL: `https://rsqd56n.9router.com/v1`
- Model: `cx/gpt-5.5`
- API key test đã được cấu hình sẵn trong app.

Nếu nhập key khác trong UI và bấm `Save AI Config`, key đó sẽ override key mặc định.

## 20. Workflow khuyến nghị

1. Mở file `.dlt`.
2. Bấm `AI Focus`.
3. Bấm `Run AI Auto Scan`.
4. Nếu muốn hỏi sâu, dùng ô chat trong `AI Workbench`.
5. Khi thấy dòng nghi ngờ, click dòng đó rồi bấm `Chat với dòng chọn` hoặc `Analyze Row`.
6. Nếu lỗi kéo dài, nhập A-B rồi dùng `AI A-B`.
7. Dùng bookmark/highlight để lưu evidence.
8. Export JSON/CSV nếu cần chia sẻ.

## 21. Troubleshooting

Nếu app không chạy:

```powershell
npm.cmd install
npm.cmd start
```

Nếu RAG không có docs:

- Kiểm tra `system_space.txt` nằm cùng thư mục app.
- Bấm `Add ECU Docs`.
- Xem dòng `Docs: ... chunks`.

Nếu AI không trả đúng:

- Kiểm tra model là `cx/gpt-5.5`.
- Kiểm tra base URL là `https://rsqd56n.9router.com/v1`.
- Thử chạy:

```powershell
node scripts\test-ai.js --diagnose
```

Nếu DLT parse ít message:

- Kiểm tra file có storage header DLT không.
- Nếu là text log, mở `.log` hoặc `.txt`.
- Nếu là non-verbose DLT, cần FIBEX/ARXML để decode đầy đủ.

## 22. File quan trọng

- `electron-main.js`: Electron main process, IPC, AI config, RAG bootstrap.
- `preload.js`: API an toàn cho renderer.
- `renderer.js`: UI, virtual scroll, filter, AI Workbench, chat.
- `style.css`: giao diện.
- `src/parser/dltParser.js`: parser DLT/text.
- `src/workers/parseWorker.js`: worker parse file lớn.
- `src/services/aiClient.js`: client gọi 9router/OpenAI-compatible API.
- `src/services/contextBuilder.js`: gom context log và tạo prompt.
- `src/services/ragStore.js`: RAG local.
- `src/services/docReader.js`: đọc text/XML/DOCX.
- `system_space.txt`: tài liệu ECU mặc định.

