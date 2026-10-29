# Plan — app-gemini-chat

> Express + @google/genai chat app (server.js + app.js + public/).

## Kết quả Review (audit đợt 1)

| # | Severity | Vị trí | Vấn đề | Fix |
|---|----------|--------|--------|-----|
| 1 | CRITICAL | app.js:12-17 | 1 chat session TOÀN CỤC dùng chung → lịch sử hội thoại leak chéo giữa mọi client; lỗi lúc create làm sập server khi khởi động | Tạo per-request session trong `sendMessageToGemini` |
| 2 | MAJOR | app.js:23-25 | Lỗi Gemini bị nuốt, trả string thân thiện với HTTP 200 → client không phân biệt lỗi/thành công | Rethrow → server trả 502 |
| 3 | MAJOR | server.js | Không auth/rate limit → open relay đốt quota khi deploy | Rate limit 20 req/phút/IP (in-memory, không thêm dep) |
| 4 | MAJOR | server.js | Không timeout upstream, không graceful shutdown | `abortSignal` trong config + SIGTERM/SIGINT → server.close() |
| 5 | MINOR | server.js | Server chấp nhận body 1MB trong khi client maxlength 4000 | Limit 64kb + cap 4000 ký tự server-side |
| 6 | MINOR | app.js | Model + systemInstruction hardcode | Env override `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS` |
| 7 | MINOR | public/index.html:171 | `escapeHtml` thiếu `"`/`'` | Escape đủ 5 entities |
| 8 | MINOR | public/index.html:212 | fetch không timeout → UI treo "Đang xử lý..." | `AbortSignal.timeout(45000)` |
| 9 | MINOR | README | Links `file:///Users/nguyenson/...` chết | Relative links |
| 10 | MINOR | server.js | Bind mặc định không HOST config | `HOST` env |

## Trạng thái

- [x] Plan
- [x] Fix #1–#9
- [x] Commit + self-review

## Ghi chú

- Đã kiểm tra SDK `@google/genai` (genai.d.ts): `sendMessage(params)` nhận 1 tham số; `abortSignal` đặt trong `config: GenerateContentConfig`. Lần đầu viết sai signature 2 tham số — đã sửa sau khi đọc type definitions.
- Rate limit in-memory: phù hợp single-instance; nếu scale nhiều instance cần store chung (Redis).
- README đã cảnh báo revoke key cũ từng bị commit — giữ nguyên warning.

## Review Log

### Vòng 1
- Self-review: per-request chat session đúng ý đồ (không còn leak lịch sử chéo client); lỗi propagate lên server.js → 502 với message chung chung, stack chỉ log server-side; rate limiter có interval dọn bucket `.unref()` không chặn exit; graceful shutdown có fallback force-exit 10s.

## Round 2 (2026-10-29)

### Findings (audit đợt 2)

| # | Severity | Vị trí | Vấn đề | Hướng xử lý |
|---|----------|--------|--------|-------------|
| 1 | MAJOR | app.js (working tree) | Có thay đổi CHƯA commit: model allowlist + `resolveModel` (dựng dở từ phiên trước) — client chưa có UI chọn model, không có endpoint liệt kê model | Commit riêng + hoàn thiện: GET `/api/models`, client model selector |
| 2 | MAJOR | public/index.html | `bubble.innerHTML = text` cho TẤT CẢ message — user text chỉ an toàn nhờ escape trước; AI reply render raw text (markdown trong reply hiện nguyên ký hiệu `**`, ```) | Mini markdown renderer an toàn: escape toàn bộ trước, sau đó whitelist format (bold/italic/code/pre/heading/list/link noopener) |
| 3 | MAJOR | public/index.html | Không có conversation history: reload là mất hết; 1 khung chat duy nhất | Đa hội thoại lưu localStorage (max 20), sidebar new/rename/delete/export |
| 4 | MINOR | public/index.html | Không có nút stop khi request đang chạy (fetch abort), không có copy message, không regenerate | AbortController + copy + regenerate |
| 5 | MINOR | server.js | Thiếu security headers (X-Content-Type-Options, CSP...), không có GET /api/models | Helmet-lite tự viết (không thêm dep), endpoint models |
| 6 | MINOR | public/index.html | Toàn bộ CSS + JS inline trong index.html; header hardcode "Gemini 2.5 Flash" | Tách `public/style.css` + `public/app.js`, header hiển thị model đang chọn |
| 7 | MINOR | server.js | 404/route lạ trả HTML mặc định express; thiếu error middleware JSON | 404 JSON + error handler cuối |

### Trạng thái Round 2

- [x] Plan
- [x] Commit các thay đổi dựng dở từ round 1 (model allowlist server-side)
- [x] Code: GET /api/models, security headers, error handler
- [x] UI: tách file, design system (token CSS), markdown render an toàn
- [x] Features: model selector, đa hội thoại (localStorage), copy/regenerate/stop
- [x] Verify: node --check, smoke test server
- [x] Self-review + commit
