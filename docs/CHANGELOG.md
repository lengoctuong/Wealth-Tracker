# Changelog - Wealth Tracker nâng cấp chuyên nghiệp

Tất cả những thay đổi quan trọng về tính năng, logic và hiệu năng của ứng dụng sẽ được ghi nhận tại đây.

## [2.4.0] - 2026-04-27 (Chuẩn hóa các tài sản tĩnh & Nhất quán Dữ liệu)

### 🏦 Chuẩn hóa Tài sản tĩnh (Static Assets Standardization)
- **Tách biệt hoàn toàn:** Phân định rõ ràng giữa nhóm Tài sản Đầu tư (theo dõi theo giao dịch) và Tài sản Tĩnh (theo dõi theo số dư).
- **Bổ sung cột nghiệp vụ:** Hỗ trợ hiển thị cột **Lãi suất** (cho Tiết kiệm) và cột **Thay đổi** giá trị so với vốn gốc để người dùng dễ dàng theo dõi hiệu quả của các tài sản không biến động theo thị trường.
- **Tối ưu hiển thị:** Tự động ẩn các trường dữ liệu không cần thiết (như Symbol) đối với nhóm tài sản tĩnh.

### 🏗️ Tái cấu trúc & Nhất quán (Data Integrity)
- **Chuẩn hóa Phân loại:**
    - Chuyển `bot` từ tài sản đầu tư sang tài sản tĩnh (giống tiền mặt/tiết kiệm), loại bỏ việc lấy giá tự động không cần thiết.
    - Nhất quán hóa `coin` và `crypto` về một mã duy nhất là `coin`.
    - Loại bỏ phân loại `position` (Vị thế) do thiếu các tham số tính toán chuyên sâu (leverage, entry price).
- **Phát hiện trùng lặp:** Thêm logic kiểm tra giao dịch đã tồn tại trong lúc Import Bulk để tránh dữ liệu rác.

### 📤 Tính di động (Data Portability)
- **Portable Export/Import:** Chỉnh sửa logic Xuất dữ liệu để loại bỏ ID hệ thống, giúp file JSON có thể nhập vào bất kỳ tài khoản người dùng nào khác mà vẫn giữ nguyên cấu trúc.

### 💎 Tối ưu hóa Firestore (Cost Saving)
- **Smart Sync (Dirty Check):** Triển khai cơ chế kiểm tra dữ liệu trước khi ghi. Hệ thống chỉ ghi vào DB nếu dữ liệu lịch sử tài sản có thay đổi, giúp giảm hơn 90% số lượng lượt ghi (Write operations), bảo vệ hạn mức 20k/ngày của Firebase Free Tier.
- **Phát hiện Quota Exceeded:** Thêm thông báo lỗi chi tiết khi hết hạn mức ghi Firestore để người dùng chủ động biết nguyên nhân.

### 🎨 Trải nghiệm người dùng (UX)
- **Sync Confirmation:** Thêm Modal xác nhận trước khi đồng bộ toàn bộ tài sản với các tùy chọn thông báo linh hoạt.
- **Cải thiện Modal Nhập:** Cho phép đóng cửa sổ nhập "Tài sản khác" trong lúc đang tải dữ liệu.

### 🛠️ Sửa lỗi (Bug Fixes)
- **Fix Crash Import:** Sửa lỗi `undefined` khi kiểm tra giao dịch trùng lặp trong trường hợp người dùng chưa có dữ liệu lịch sử.
- **Fix Props Mismatch:** Sửa lỗi truyền props `confirmText` và `confirmVariant` trong component `ConfirmModal`.

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
