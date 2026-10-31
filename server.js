import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendMessageToGemini, AVAILABLE_MODELS, DEFAULT_MODEL } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.disable("x-powered-by");

// Security headers — nhẹ, không thêm dependency (thay helmet cho scope này).
// CSP: toàn bộ JS/CSS phục vụ từ file tĩnh, không CDN, không inline script và
// không inline style attribute (style dùng class trong style.css) → chặt nhất
// có thể: mọi origin đều là 'self'. Round 3 đã audit: app không load lib nào
// từ CDN (marked/DOMPurify/highlight.js đều không có — markdown tự viết), nên
// không cần vendor lib nào. Nếu sau này thêm lib client, hãy tự host trong
// public/vendor/ và KHÔNG thêm origin CDN vào CSP.
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  });
  next();
});

app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Very light in-memory rate limit: 20 req/phút/IP — chặn open relay đốt quota
// Gemini khi deploy public (không cần dependency ngoài).
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;
const rateBuckets = new Map(); // ip -> { count, resetAt }
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

// Danh sách model cho client render model selector
app.get("/api/models", (req, res) => {
  res.json({
    models: AVAILABLE_MODELS,
    default: DEFAULT_MODEL,
  });
});

app.post("/api/chat", async (req, res) => {
  // Rate limit
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT) {
    return res.status(429).json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." });
  }

  const { message, history, model } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Trường 'message' là bắt buộc." });
  }
  const trimmed = message.trim();
  if (trimmed.length > 4000) {
    return res.status(400).json({ error: "Tin nhắn quá dài (tối đa 4000 ký tự)." });
  }

  // Lịch sử hội thoại do client gửi (để AI có ngữ cảnh): validate chặt —
  // tối đa 20 lượt, mỗi lượt là { role: 'user'|'model', text: string ≤ 4000 }.
  let validatedHistory = [];
  if (history !== undefined) {
    if (!Array.isArray(history) || history.length > 20) {
      return res.status(400).json({ error: "Trường 'history' không hợp lệ." });
    }
    for (const turn of history) {
      if (
        !turn || typeof turn !== "object" ||
        (turn.role !== "user" && turn.role !== "model") ||
        typeof turn.text !== "string" || turn.text.length > 4000
      ) {
        return res.status(400).json({ error: "Trường 'history' không hợp lệ." });
      }
      validatedHistory.push({ role: turn.role, text: turn.text });
    }
  }

  try {
    const reply = await sendMessageToGemini(trimmed, { model, history: validatedHistory });
    res.json({ reply });
  } catch (error) {
    // Log chi tiết server-side, trả message chung chung — không leak stack/chi tiết API
    console.error("Chat endpoint error:", error);
    res.status(502).json({ error: "Lỗi máy chủ khi xử lý yêu cầu." });
  }
});

// 404 JSON thay vì trang HTML mặc định của Express (API-first)
app.use((req, res) => {
  res.status(404).json({ error: "Không tìm thấy endpoint." });
});

// Error handler cuối — bắt JSON parse lỗi / lỗi không mong muốn, không leak stack
app.use((err, req, res, _next) => {
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "Body JSON không hợp lệ." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Body quá lớn." });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Lỗi máy chủ." });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Gemini Chat server đang chạy tại http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
});

// Graceful shutdown — không drop in-flight requests khi redeploy
function shutdown(signal) {
  console.log(`${signal} received — shutting down...`);
  server.close(() => process.exit(0));
  // Fallback: force exit nếu close bị treo
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
