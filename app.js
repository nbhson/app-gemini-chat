import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SYSTEM_INSTRUCTION =
  "You are a helpful and friendly AI assistant. Your responses should be informative, concise, and engaging. Use markdown for formatting when appropriate.";
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

export const sendMessageToGemini = async (message) => {
  // Per-request chat session: TRƯỚC ĐÂY dùng 1 session toàn cục dùng chung →
  // lịch sử hội thoại leak chéo giữa các client khác nhau, và lỗi lúc module
  // load làm sập server ngay khi khởi động.
  const chat = ai.chats.create({
    model: MODEL,
    config: { systemInstruction: SYSTEM_INSTRUCTION },
  });

  // Timeout để hung request không giữ socket vĩnh viễn
  const response = await chat.sendMessage({
    message,
    config: { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  });
  return response.text;
};
