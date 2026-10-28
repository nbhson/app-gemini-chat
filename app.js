import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Allowlist các model client được chọn — KHÔNG chấp nhận model tùy ý từ
// request (tránh dùng server làm proxy tới model bất kỳ / tốn phí).
export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

const DEFAULT_MODEL = process.env.GEMINI_MODEL || AVAILABLE_MODELS[0].id;
const SYSTEM_INSTRUCTION =
  "You are a helpful and friendly AI assistant. Your responses should be informative, concise, and engaging. Use markdown for formatting when appropriate.";
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

export const resolveModel = (requested) =>
  AVAILABLE_MODELS.some((m) => m.id === requested) ? requested : DEFAULT_MODEL;

export const sendMessageToGemini = async (message, { model } = {}) => {
  // Per-request chat session: TRƯỚC ĐÂY dùng 1 session toàn cục dùng chung →
  // lịch sử hội thoại leak chéo giữa các client khác nhau, và lỗi lúc module
  // load làm sập server ngay khi khởi động.
  const chat = ai.chats.create({
    model: resolveModel(model),
    config: { systemInstruction: SYSTEM_INSTRUCTION },
  });

  // Timeout để hung request không giữ socket vĩnh viễn
  const response = await chat.sendMessage({
    message,
    config: { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  });
  const text = response?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
};
