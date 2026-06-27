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

Trong [app.js](file:///Users/nguyenson/Github/gemini/app.js), dự án sử dụng API Key để xác thực với dịch vụ Gemini.

> [!WARNING]
> Không nên chia sẻ hoặc commit trực tiếp API Key lên các kho lưu trữ công khai như GitHub. Để bảo mật hơn, bạn nên chuyển sang sử dụng biến môi trường (Environment Variable) như `process.env.GEMINI_API_KEY`.

### 3. Chạy thử nghiệm qua Console

Hiện tại, file [app.js](file:///Users/nguyenson/Github/gemini/app.js) được cấu hình để gửi một câu hỏi mặc định qua Console:

```bash
npm start
```

Kết quả phản hồi từ Gemini sẽ được in trực tiếp ra màn hình terminal của bạn.

---

## 🛠️ Lưu ý về việc kết nối Frontend & Backend

Giao diện web trong [public/index.html](file:///Users/nguyenson/Github/gemini/public/index.html) được thiết kế để gửi yêu cầu POST đến endpoint `/api/chat`. 

Để chạy được đầy đủ tính năng trên giao diện web này, ứng dụng cần được bổ sung một Web Server (ví dụ: **Express.js**) để:
1. Phục vụ giao diện HTML tĩnh (`public/index.html`).
2. Nhận yêu cầu từ client gửi đến `/api/chat` và chuyển tiếp đến hàm `sendMessageToGemini` trong `app.js` trước khi phản hồi lại cho giao diện web.
