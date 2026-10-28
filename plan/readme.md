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
