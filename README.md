# Gemini Chat App

Một ứng dụng Node.js đơn giản kết nối với mô hình **Gemini 2.5 Flash** thông qua SDK chính thức mới nhất của Google (`@google/genai`).

## 📁 Cấu trúc thư mục

*   [app.js](app.js): Script phía backend thực hiện kết nối và gửi tin nhắn đến Gemini API.
*   [server.js](server.js): Express server phục vụ giao diện tĩnh và endpoint `/api/chat`.
*   [public/index.html](public/index.html): Giao diện web người dùng để tương tác với Gemini (sử dụng HTML/CSS và Vanilla JS).
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

## 🔒 Thư viện client bên thứ ba (vendoring policy)

App **không load bất kỳ thư viện nào từ CDN** (đã audit Round 3: không có
`<script>`/`<link>`/`@import` trỏ ra ngoài — markdown renderer, escape, highlight
đều tự viết bằng vanilla JS). Vì vậy CSP có thể chặt ở mức:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; ...
```

(không có origin CDN, không `'unsafe-inline'` cho script lẫn style — style inline
đã chuyển hết vào `public/style.css`).

Nếu sau này cần thêm thư viện client (ví dụ marked, DOMPurify, highlight.js):

1. **Tự host, không dùng CDN** — tải bản đã pin version vào `public/vendor/`,
   ví dụ `public/vendor/marked-12.0.2.min.js`, kèm file `LICENSE` của lib cùng
   thư mục. Các lib trên đều MIT/BSD-3 nên compatible.
2. Tham chiếu local: `<script src="/vendor/marked-12.0.2.min.js"></script>` —
   CSP `script-src 'self'` đã đủ, **không thêm** origin CDN vào CSP.
3. **Cách update version vendored**: thay file mới (giữ nguyên tên có version
   trong tên file hoặc bump tên), update tham chiếu trong `public/index.html`,
   kèm file LICENSE mới, rồi smoke test lại (xem CSP header trên `/` vẫn chỉ
   chứa `'self'`).
4. Pin version cụ thể (không dùng bản "latest") và kiểm tra
   [snyk.io](https://snyk.io) hoặc advisory của lib trước khi upgrade.

## 📂 Cấu trúc thư mục

*   [server.js](server.js): Express server, phục vụ static + `/api/chat`.
*   [app.js](app.js): Logic kết nối Gemini.
*   [public/index.html](public/index.html): Giao diện web.
