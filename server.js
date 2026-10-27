import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendMessageToGemini } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  const { message } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Trường 'message' là bắt buộc." });
  }

  try {
    const reply = await sendMessageToGemini(message.trim());
    res.json({ reply });
  } catch (error) {
    console.error("Chat endpoint error:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi xử lý yêu cầu." });
  }
});

app.listen(PORT, () => {
  console.log(`Gemini Chat server đang chạy tại http://localhost:${PORT}`);
});
