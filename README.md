# Gemini Chat App

Một ứng dụng Node.js đơn giản kết nối với mô hình **Gemini 2.5 Flash** thông qua SDK chính thức mới nhất của Google (`@google/genai`).

## 📁 Cấu trúc thư mục

*   [app.js](file:///Users/nguyenson/Github/gemini/app.js): Script phía backend thực hiện kết nối và gửi tin nhắn đến Gemini API.
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

## 🛠️ Lưu ý về việc kết nối Frontend & Backend

Giao diện web trong [public/index.html](file:///Users/nguyenson/Github/gemini/public/index.html) được thiết kế để gửi yêu cầu POST đến endpoint `/api/chat`. 

Để chạy được đầy đủ tính năng trên giao diện web này, ứng dụng cần được bổ sung một Web Server (ví dụ: **Express.js**) để:
1. Phục vụ giao diện HTML tĩnh (`public/index.html`).
2. Nhận yêu cầu từ client gửi đến `/api/chat` và chuyển tiếp đến hàm `sendMessageToGemini` trong `app.js` trước khi phản hồi lại cho giao diện web.
