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

> Lưu ý: phiên trước bị gián đoạn — chỉ kịp commit phần server-side (model
> allowlist, `f834565`) và viết plan; toàn bộ mục client dưới đây đã được
> **triển khai lại và hoàn thành thật** trong Round 2 này.

### Findings (audit đợt 2)

| # | Severity | Vị trí | Vấn đề | Hướng xử lý |
|---|----------|--------|--------|-------------|
| 1 | MAJOR | app.js (working tree) | Thay đổi CHƯA commit từ phiên gián đoạn: model allowlist + `resolveModel` — client chưa có UI chọn model, không có endpoint liệt kê model | GET `/api/models`, client model selector |
| 2 | MAJOR | public/index.html | `bubble.innerHTML = text` cho TẤT CẢ message; AI reply chỉ escape (mất markdown), không format | Mini markdown renderer an toàn: escape toàn bộ trước, whitelist format (bold/italic/code/pre/heading/list/link http(s) noopener) |
| 3 | MAJOR | public/index.html | Không có conversation history: reload mất hết; AI KHÔNG có ngữ cảnh giữa các lượt (per-request session round 1 làm mất continuity) | Đa hội thoại localStorage (max 20) + client gửi `history` (server validate ≤20 lượt) |
| 4 | MAJOR | server.js + app.js | Chat không nhớ ngữ cảnh — mỗi request chỉ gửi 1 message | `/api/chat` nhận `history[]` đã validate, phát lại vào session per-request |
| 5 | MINOR | public/index.html | Không stop/copy/regenerate khi đang chạy | AbortController (nút send → stop), copy từng message, regenerate từ tin nhắn user cuối |
| 6 | MINOR | server.js | Thiếu security headers, GET /api/models, 404 trả HTML, không error middleware JSON | Helmet-lite tự viết, CSP chỉ 'self' (đã tách file tĩnh), 404 JSON, error handler bắt bad-JSON/413 |
| 7 | MINOR | public/index.html | CSS+JS inline; header hardcode model; không có theme sáng/tối | Tách `public/style.css` + `public/app.js`, design tokens, dark/light toggle có persist |

### Trạng thái Round 2

- [x] Plan
- [x] Commit thay đổi dựng dở từ round 1 (đã commit sẵn: `f834565`)
- [x] feat(server): /api/models, security headers, 404/error middleware, history — `bcf32fa`
- [x] feat(ui): tách file, design system, theme toggle, markdown an toàn, đa hội thoại, model selector, stop/copy/regenerate/export — commit client
- [x] Verify: `node --check` (server.js, app.js, public/app.js); smoke test server (models/404/bad-JSON/history-validate/502 khi key dummy); fix bug DEFAULT_MODEL thiếu import khi smoke test
- [x] Self-review + commit

### Verify Log

- `node --check` pass cho cả 3 file JS.
- Smoke test `PORT=3789 GEMINI_API_KEY=dummy node server.js`: GET /api/models → JSON đúng allowlist; GET /api/nope → 404 JSON; POST body hỏng → 400 "Body JSON không hợp lệ"; history sai shape → 400; POST /api/chat hợp lệ → 502 (đúng, vì key dummy); header CSP/nosniff/DENY/no-referrer xuất hiện trên /; static /app.js + /style.css → 200.
