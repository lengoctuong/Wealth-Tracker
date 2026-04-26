# Changelog - Wealth Tracker nâng cấp chuyên nghiệp

Tất cả những thay đổi quan trọng về tính năng, logic và hiệu năng của ứng dụng sẽ được ghi nhận tại đây.

## [2.3.0] - 2026-04-27 (Tối ưu hóa Hiệu năng Cao)

### ⚡ Hiệu năng (Performance)
- **Fix lỗi Memory Leak toàn cục:** Tách thành phần `HeaderClock` để cô lập việc cập nhật thời gian, ngăn chặn toàn bộ ứng dụng bị re-render mỗi giây.
- **Tối ưu hóa Firebase Snapshots:** Sử dụng `useRef` để kiểm soát các bản ghi snapshot, triệt tiêu vòng lặp fetch dữ liệu vô tận.
- **Recharts Downsampling:** Giới hạn dữ liệu biểu đồ ở mức tối đa 300 điểm, đảm bảo thao tác hover mượt mà và không gây crash trình duyệt trên các máy có cấu hình yếu.

### 🛠️ Sửa lỗi (Bug Fixes)
- **Safe Rendering:** Xử lý triệt để lỗi runtime `toFixed` khi ứng dụng ở trạng thái dữ liệu rỗng.

---

## [2.2.0] - 2026-04-27 (Nghiệp vụ Chuyên sâu & Sửa lỗi)

### 🚀 Tính năng mới (Core Logic)
- **Giá vốn Bình quân (Moving Average - MA):** Triển khai logic tính giá vốn chuyên biệt cho Tab Chứng khoán để khớp hoàn toàn với dữ liệu từ các App SSI/VNDIRECT.
- **Bảng Hiệu suất:** Cải thiện cột Tổng cộng (Lãi kép) và tự động sắp xếp mã tài sản theo hiệu suất từ cao xuống thấp.
- **Phân rã Lợi nhuận:** Tách bạch rõ rệt Lãi tạm tính (Unrealized) và Lãi đã chốt (Realized) ngay tại Dashboard.
- **Tỷ suất sinh lời hiện tại:** Bổ sung hiển thị % lãi/lỗ trên giá vốn cho các vị thế đang nắm giữ.

### 🛠️ Sửa lỗi (Bug Fixes)
- **Lỗi ngày 31:** Sửa logic so sánh timestamp để lấy chính xác giá chốt phiên của các ngày cuối tháng có 31 ngày.
- **UI/UX:** Đảo vị trí hiển thị % ra trước số tiền lãi để giao diện chuyên nghiệp hơn.

---

## [2.1.0] - 2026-04-26 (Đồ thị & Tối ưu hóa sơ bộ)

### 📊 Biểu đồ (Charts)
- **Biểu đồ So sánh Hiệu suất:** Đối chiếu trực tiếp mức tăng trưởng của tài khoản với chỉ số VN-Index (TWRR).
- **Biểu đồ Biến động Tài sản:** Theo dõi tương quan giữa Tổng tài sản, Vốn đầu tư ròng và Lợi nhuận theo thời gian.

### ⚙️ Hệ thống (System)
- **Hệ thống Batch Write (Firestore):** Tự động chia nhỏ các lệnh ghi dữ liệu theo lô để tránh giới hạn của Firebase.
- **Cơ chế Xóa nhanh:** Tối ưu hóa tốc độ dọn dẹp hệ thống khi người dùng muốn Reset dữ liệu.
- **Auto-Sync Historical Data:** Tự động đồng bộ dữ liệu VN-Index quá khứ từ Python API.

---

## [2.0.0] - 2026-04-25 (Nâng cấp Hệ thống lõi)

### 💎 Tính năng cốt lõi
- **Thuật toán FIFO (First-In-First-Out):** Cơ chế khớp lệnh mua/bán chuẩn kế toán để tính lãi/lỗ thực tế.
- **Backfill History Engine:** Tự động tái tạo lại toàn bộ lịch sử biến động tài sản từ giao dịch đầu tiên.
- **Chỉ số TWRR (Time-Weighted Rate of Return):** Đo lường hiệu suất loại bỏ hoàn toàn nhiễu từ dòng tiền nạp/rút.
- **Bộ lọc thời gian:** Hỗ trợ xem dữ liệu linh hoạt (7d, 30d, 3m, 6m, 1y, 3y, 5y, All).

### 🎨 Giao diện (UI/UX)
- **Thanh tiến trình (Progress Bar):** Hiển thị trạng thái cho các tác vụ nặng (Import, Sync).
- **Collapsible Debug Tools:** Thu gọn các bảng tính toán chi tiết giúp giao diện gọn gàng.

---

## [1.0.0] - Phiên bản gốc (Quản lý số dư cơ bản)

### ✨ Tính năng chính
- **Quản lý tài sản:** Thêm/sửa/xóa nguồn tiền và tài sản cơ bản.
- **Đồng bộ giá:** Tải giá hiện tại thông qua API đơn giản.
- **Phân bổ tài sản:** Biểu đồ tròn hiển thị tỷ lệ tài sản theo danh mục.
