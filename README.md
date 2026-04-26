# 💰 Wealth Tracker

**Wealth Tracker** là một ứng dụng quản lý tài chính cá nhân toàn diện, giúp bạn theo dõi tài sản từ tiền mặt, tiết kiệm đến các kênh đầu tư như Chứng khoán, Crypto và Quỹ.

## ✨ Tính năng chính

- **Quản lý đa tài khoản:** Hỗ trợ Ngân hàng, Ví điện tử, Sàn chứng khoán, Ví Crypto.
- **Theo dõi hiệu suất đầu tư:** Tự động tính toán lợi nhuận theo phương pháp **TWRR** (Time-Weighted Rate of Return) để loại bỏ ảnh hưởng của dòng tiền.
- **Quản lý kho theo FIFO:** Tính toán lãi/lỗ dựa trên phương pháp nhập trước xuất trước.
- **Đồng bộ giá thị trường:** Tự động lấy giá chứng khoán VN, giá Crypto và VN-INDEX.
- **Biểu đồ trực quan:** So sánh hiệu suất danh mục với VN-INDEX qua các mốc thời gian.
- **Bảo mật:** Đăng nhập an toàn qua Google Firebase.

## 🚀 Hướng dẫn khởi chạy

### Yêu cầu hệ thống
- Node.js (v18+)
- Python 3 (cho backend lấy giá)

### Các bước thực hiện

1.  **Cài đặt thư viện:**
    ```bash
    npm install
    ```

2.  **Cấu hình biến môi trường:**
    Tạo file `.env.local` và thêm các thông tin sau:
    ```env
    GEMINI_API_KEY=your_gemini_key
    VITE_FIREBASE_API_KEY=your_firebase_key
    ... (xem .env.example để biết thêm chi tiết)
    ```

### 1. Frontend (React)
```bash
npm install
npm run dev
```

### 2. Backend (Python Finance Server)
Ứng dụng cần server này để lấy dữ liệu giá chứng khoán và crypto.

**Yêu cầu:** Python 3.8+

**Cài đặt thư viện:**
```bash
pip install fastapi uvicorn requests beautifulsoup4 pandas yfinance vnstock
```

**Chạy Server:**
```bash
python -m uvicorn finance-server:app --reload --port 8000
```
*Mặc định server chạy tại: http://localhost:8000*

## 📚 Tài liệu
Chi tiết về kiến trúc, logic xử lý tài chính và hướng dẫn sử dụng có thể tìm thấy tại:
👉 [**Documentation Index**](./docs/INDEX.md)

## 🛠️ Công nghệ sử dụng

- **Frontend:** React, TypeScript, Tailwind CSS, Shadcn UI, Recharts.
- **Backend:** Express.js, Python (FastAPI/Flask).
- **Database:** Firebase Firestore.
- **Auth:** Firebase Auth.

---
*Phát triển bởi [Lê Ngọc Tường](https://github.com/lengoctuong)*

