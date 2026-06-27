
import { GoogleGenAI, Chat } from "@google/genai";

const API_KEY = 'AIzaSyBeJAgwoeEI-NMo_MmCOBb4lb5m_GkTgN0';

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

console.log(API_KEY)

const chat = ai.chats.create({
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: 'You are a helpful and friendly AI assistant. Your responses should be informative, concise, and engaging. Use markdown for formatting when appropriate.',
  },
});

export const sendMessageToGemini = async (message) => {
  try {
    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    return "I'm sorry, I'm having trouble connecting. Please try again later.";
  }
};

sendMessageToGemini("Bạn có thể xây dựng giao diện UI UX không?")  .then(response => {
    console.log("Gemini's response:", response);
  })
  .catch(error => {
    console.error("Error:", error);
  });