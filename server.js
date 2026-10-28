import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendMessageToGemini } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.disable("x-powered-by");
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

  const { message } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Trường 'message' là bắt buộc." });
  }
  const trimmed = message.trim();
  if (trimmed.length > 4000) {
    return res.status(400).json({ error: "Tin nhắn quá dài (tối đa 4000 ký tự)." });
  }

  try {
    const reply = await sendMessageToGemini(trimmed);
    res.json({ reply });
  } catch (error) {
    // Log chi tiết server-side, trả message chung chung — không leak stack/chi tiết API
    console.error("Chat endpoint error:", error);
    res.status(502).json({ error: "Lỗi máy chủ khi xử lý yêu cầu." });
  }
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
