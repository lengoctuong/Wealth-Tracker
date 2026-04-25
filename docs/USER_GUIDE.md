# Hướng dẫn sử dụng Wealth Tracker

## 1. Thiết lập ban đầu
- **Đăng nhập:** Sử dụng tài khoản Google để đăng nhập.
- **Cấu hình Backend:** Vào phần **Cài đặt** (biểu tượng răng cưa) -> Nhập **Python Backend URL** (ngrok URL của bạn) và nhấn **Lưu**.
- **Đồng bộ giá:** Nhấn **Lưu giá thị trường vào DB** trong Cài đặt để ứng dụng có dữ liệu lịch sử hiển thị biểu đồ.

## 2. Quản lý Tài khoản & Tài sản
- **Thêm Nguồn tài sản:** Nhấn nút **+ Nguồn** để thêm ngân hàng, sàn chứng khoán mới.
- **Thêm Tài sản:** Nhấn nút **+ Tài sản**, chọn Nguồn tài sản và loại tài sản (Cổ phiếu, Coin, Tiết kiệm...).

## 3. Nhập dữ liệu giao dịch
Có 2 cách để cập nhật số dư cho các tài sản đầu tư (Chứng khoán/Crypto):

### Cách 1: Nhập thủ công
- Click vào biểu tượng **Lịch sử giao dịch** (mũi tên 2 chiều) ở dòng tài sản đó.
- Nhập thông tin Mua/Bán, Số lượng và Giá.

### Cách 2: Nhập hàng loạt (Bulk Import)
- Vào **Cài đặt** -> **Nhập giao dịch đầu tư**.
- Chọn file JSON có định dạng chuẩn (xem file `invest.json` mẫu trong repository).

## 4. Theo dõi hiệu suất
- **Thẻ Tổng quan:** Xem tổng tài sản ròng và so sánh hiệu suất toàn bộ danh mục với VN-INDEX.
- **Thẻ Đầu tư:** Xem chi tiết từng tài sản, biểu đồ lãi/lỗ của từng tài khoản và bảng kê FIFO (First-In First-Out).
- **Công cụ Debug:** Dưới mỗi bảng tài sản có phần "CHI TIẾT TÍNH TOÁN TWRR" giúp bạn kiểm tra từng bước tính toán dòng tiền và lợi nhuận tích lũy.
