# Gemini Chat App

Một ứng dụng Node.js đơn giản kết nối với mô hình **Gemini 2.5 Flash** thông qua SDK chính thức mới nhất của Google (`@google/genai`).

## 📁 Cấu trúc thư mục

*   [app.js](file:///Users/nguyenson/Github/gemini/app.js): Script phía backend thực hiện kết nối và gửi tin nhắn đến Gemini API.
*   [server.js](file:///Users/nguyenson/Github/gemini/server.js): Express server phục vụ giao diện tĩnh và endpoint `/api/chat`.
*   [public/index.html](file:///Users/nguyenson/Github/gemini/public/index.html): Giao diện web người dùng để tương tác với Gemini (sử dụng HTML/CSS và Vanilla JS).
*   `package.json`: Chứa thông tin cấu hình dự án và danh sách các thư viện phụ thuộc.

## 🚀 Hướng dẫn cài đặt và chạy thử

### 1. Cài đặt các thư viện phụ thuộc

Mở terminal tại thư mục dự án và chạy lệnh sau để cài đặt các package cần thiết:

```bash
npm install
```

### 2. Cấu hình API Key

Ứng dụng đọc API key từ biến môi trường `GEMINI_API_KEY`. Tạo file `.env` (đã được gitignore) hoặc export trước khi chạy:

```bash
export GEMINI_API_KEY="your-api-key-here"
```

> [!WARNING]
> Không commit API key vào source code. Key cũ từng bị commit — hãy thu hồi (revoke) key đó trong Google AI Studio và tạo key mới.

### 3. Chạy thử nghiệm qua Console

```bash
npm start
```

---

## 🛠️ Kết nối Frontend & Backend

File `server.js` khởi tạo một **Express** server để:
1. Phục vụ giao diện HTML tĩnh từ thư mục `public/`.
2. Nhận request POST từ client tại `/api/chat` và chuyển tiếp đến Gemini thông qua `sendMessageToGemini`.

```bash
npm start
# Server chạy tại http://localhost:3000
```

### API Endpoint

**POST `/api/chat`**
- Body: `{ "message": "nội dung tin nhắn" }`
- Response: `{ "reply": "phản hồi từ Gemini" }`

## 📂 Cấu trúc thư mục

*   [server.js](file:///Users/nguyenson/Github/gemini/server.js): Express server, phục vụ static + `/api/chat`.
*   [app.js](file:///Users/nguyenson/Github/gemini/app.js): Logic kết nối Gemini.
*   [public/index.html](file:///Users/nguyenson/Github/gemini/public/index.html): Giao diện web.
