# Changelog - Wealth Tracker nâng cấp chuyên nghiệp

Tất cả những thay đổi quan trọng về tính năng, logic và hiệu năng của ứng dụng sẽ được ghi nhận tại đây.

## [2.4.0] - 2026-04-27 (Hệ thống Dashboard Lai & Chuẩn hóa Đầu tư)

### 🚀 Hệ thống Dashboard "Lai" (Hybrid Dashboard Logic)
- **Tab Đầu tư (CK, Crypto, Fintech):** Triển khai bảng 7 cột chi tiết. Theo dõi **Vốn gốc (Purchase Price)** đối lập với **Giá trị hiện tại (Current Price)** cho tất cả loại tài sản, bao gồm cả Tiền mặt/USDT.
- **Tab Quản lý (Ngân hàng, Ví, Khác):** Duy trì giao diện tối giản tập trung vào Số dư và Lãi suất, giúp phân tách rõ ràng mục đích sử dụng tiền.

### 🤖 Hỗ trợ Tài sản đặc thù (Bot & Position)
- **Simple Investment Logic:** Thiết kế riêng cho các tài sản không có số lượng cụ thể (Bot giao dịch, Vị thế Polymarket).
- **Tối ưu hiển thị:** Ẩn cột số lượng, hiển thị chênh lệch (Lãi/Lỗ) trực tiếp giữa Tổng số dư và Vốn đầu tư.

### 🏗️ Chuẩn hóa & Nhất quán (Data Integrity)
- **Coin Migration:** Hợp nhất hoàn toàn danh mục `crypto` về mã chuẩn là `coin`.
- **Hồi sinh `position`:** Sử dụng lại mã này dành riêng cho các vị thế dự đoán/Speculative.
- **Vốn gốc bắt buộc:** Bổ sung trường `purchasePrice` cho tài sản tĩnh trong file Import để đảm bảo tính toán hiệu suất chính xác ngay từ đầu.

### 📤 Tính di động (Data Portability)
- **Portable Export/Import:** Loại bỏ ID hệ thống khi xuất dữ liệu, giúp file JSON có thể nhập vào bất kỳ tài khoản nào khác mà không gây xung đột.

### 💎 Tối ưu hóa Firestore (Cost Saving)
- **Smart Sync (Dirty Check):** Chỉ ghi dữ liệu lịch sử nếu có thay đổi thực sự, giúp giảm hơn 90% số lượng lượt ghi (Write operations).
- **Quota Management:** Thêm thông báo chi tiết khi tài khoản Firebase chạm hạn mức miễn phí (Free Tier).

### 🎨 Cải thiện Trải nghiệm (UX)
- **AddAssetModal thông minh:** Tự động điền (Auto-fill) tiền tệ USDT và đồng bộ Vốn -> Số dư cho các tài sản loại `position`.
- **Tăng trưởng linh hoạt:** Hiển thị số tiền lãi tuyệt đối cho Tiết kiệm/Tiền mặt và hiển thị cả % kèm số tiền cho các tài sản đầu tư.

---

## [2.3.0] - 2026-04-26 (Tối ưu hóa Hiệu năng Cao)

### ⚡ Hiệu năng (Performance)
- **Fix lỗi Memory Leak toàn cục:** Tách thành phần `HeaderClock` để cô lập việc cập nhật thời gian, ngăn chặn toàn bộ ứng dụng bị re-render mỗi giây.
- **Tối ưu hóa Firebase Snapshots:** Sử dụng `useRef` để kiểm soát các bản ghi snapshot, triệt tiêu vòng lặp fetch dữ liệu vô tận.
- **Recharts Downsampling:** Giới hạn dữ liệu biểu đồ ở mức tối đa 300 điểm, đảm bảo thao tác hover mượt mà và không gây crash trình duyệt trên các máy có cấu hình yếu.

### 🛠️ Sửa lỗi (Bug Fixes)
- **Safe Rendering:** Xử lý triệt để lỗi runtime `toFixed` khi ứng dụng ở trạng thái dữ liệu rỗng.

---

## [2.2.0] - 2026-04-25 (Nghiệp vụ Chuyên sâu & Sửa lỗi)

### 🚀 Tính năng mới (Core Logic)
- **Giá vốn Bình quân (Moving Average - MA):** Triển khai logic tính giá vốn chuyên biệt cho Tab Chứng khoán để khớp hoàn toàn với dữ liệu từ các App SSI/VNDIRECT.
- **Bảng Hiệu suất:** Cải thiện cột Tổng cộng (Lãi kép) và tự động sắp xếp mã tài sản theo hiệu suất từ cao xuống thấp.
- **Phân rã Lợi nhuận:** Tách bạch rõ rệt Lãi tạm tính (Unrealized) và Lãi đã chốt (Realized) ngay tại Dashboard.
- **Tỷ suất sinh lời hiện tại:** Bổ sung hiển thị % lãi/lỗ trên giá vốn cho các vị thế đang nắm giữ.

### 🛠️ Sửa lỗi (Bug Fixes)
- **Lỗi ngày 31:** Sửa logic so sánh timestamp để lấy chính xác giá chốt phiên của các ngày cuối tháng có 31 ngày.
- **UI/UX:** Đảo vị trí hiển thị % ra trước số tiền lãi để giao diện chuyên nghiệp hơn.

---

## [2.1.0] - 2026-04-24 (Đồ thị & Tối ưu hóa sơ bộ)

### 📊 Biểu đồ (Charts)
- **Biểu đồ So sánh Hiệu suất:** Đối chiếu trực tiếp mức tăng trưởng của tài khoản với chỉ số VN-Index (TWRR).
- **Biểu đồ Biến động Tài sản:** Theo dõi tương quan giữa Tổng tài sản, Vốn đầu tư ròng và Lợi nhuận theo thời gian.

### ⚙️ Hệ thống (System)
- **Hệ thống Batch Write (Firestore):** Tự động chia nhỏ các lệnh ghi dữ liệu theo lô để tránh giới hạn của Firebase.
- **Cơ chế Xóa nhanh:** Tối ưu hóa tốc độ dọn dẹp hệ thống khi người dùng muốn Reset dữ liệu.
- **Auto-Sync Historical Data:** Tự động đồng bộ dữ liệu VN-Index quá khứ từ Python API.

---

## [2.0.0] - 2026-04-01 (Nâng cấp Hệ thống lõi)

### 💎 Tính năng cốt lõi
- **Thuật toán FIFO (First-In-First-Out):** Cơ chế khớp lệnh mua/bán chuẩn kế toán để tính lãi/lỗ thực tế.
- **Backfill History Engine:** Tự động tái tạo lại toàn bộ lịch sử biến động tài sản từ giao dịch đầu tiên.
- **Chỉ số TWRR (Time-Weighted Rate of Return):** Đo lường hiệu suất loại bỏ hoàn toàn nhiễu từ dòng tiền nạp/rút.
- **Bộ lọc thời gian:** Hỗ trợ xem dữ liệu linh hoạt (7d, 30d, 3m, 6m, 1y, 3y, 5y, All).

### 🎨 Giao diện (UI/UX)
- **Thanh tiến trình (Progress Bar):** Hiển thị trạng thái cho các tác vụ nặng (Import, Sync).
- **Collapsible Debug Tools:** Thu gọn các bảng tính toán chi tiết giúp giao diện gọn gàng.

---

## [1.0.0] - Đầu năm 2026 - Phiên bản gốc (Quản lý số dư cơ bản)

### ✨ Tính năng chính
- **Quản lý tài sản:** Thêm/sửa/xóa nguồn tiền và tài sản cơ bản.
- **Đồng bộ giá:** Tải giá hiện tại thông qua API đơn giản.
- **Phân bổ tài sản:** Biểu đồ tròn hiển thị tỷ lệ tài sản theo danh mục.
