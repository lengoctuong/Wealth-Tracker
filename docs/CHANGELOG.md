# Changelog - Wealth Tracker nâng cấp chuyên nghiệp

Tất cả những thay đổi quan trọng về tính năng, logic và hiệu năng của ứng dụng sẽ được ghi nhận tại đây.

## [2.0.0] - 2026-04-25 (Phiên bản hiện tại - Nâng cấp Hệ thống lõi)

### 🚀 Tính năng mới & Core Logic
- **Thuật toán FIFO (First-In-First-Out):** Triển khai cơ chế khớp lệnh mua/bán theo thứ tự thời gian để tính toán giá vốn và lãi/lỗ thực tế chính xác nhất.
- **Backfill History Engine:** Tự động quét và tái tạo lại toàn bộ lịch sử biến động tài sản từng ngày từ giao dịch đầu tiên, cho phép xem biểu đồ tài sản trong quá khứ.
- **Chỉ số TWRR (Time-Weighted Rate of Return):** Áp dụng công thức chuẩn quốc tế để đo lường hiệu suất đầu tư, loại bỏ hoàn toàn sự sai lệch do dòng tiền nạp/rút gây ra.
- **Biểu đồ So sánh Hiệu suất:** Đối chiếu trực tiếp mức tăng trưởng của tài khoản với chỉ số VN-Index trên cùng một khung thời gian.
- **Bộ lọc thời gian linh hoạt:** Hỗ trợ xem dữ liệu theo các mốc 7d, 30d, 3m, 6m, 1y, 3y, 5y và Tất cả.
- **Hiển thị Lợi nhuận VND:** Bổ sung giá trị tiền lời tuyệt đối (VND) bên cạnh tỷ lệ phần trăm (%) ở tất cả các tab và bảng tổng quát.

### 🛠️ Tối ưu hóa & Hiệu năng
- **Fix lỗi OOM (Out of Memory):** Tối ưu hóa việc render biểu đồ bằng kỹ thuật Downsampling (giảm điểm dữ liệu khi xem khoảng thời gian dài) và Memoization, giúp ứng dụng chạy mượt trên máy có RAM thấp (8GB).
- **Hệ thống Batch Write (Firestore):** Tự động chia nhỏ các lệnh ghi dữ liệu theo lô (400-500 lệnh/lần) để tránh giới hạn của Firebase, đảm bảo hệ thống không bị crash khi xử lý hàng nghìn bản ghi.
- **Tốc độ xóa dữ liệu:** Sử dụng cơ chế xóa Batch giúp việc dọn dẹp hệ thống nhanh gấp nhiều lần so với xóa tuần tự.
- **Auto-Sync Historical Data:** Tự động phát hiện và tải dữ liệu VN-Index quá khứ từ Python API dựa trên ngày giao dịch đầu tiên khi thực hiện Import Bulk.

### 🎨 Cải tiến Giao diện (UI/UX)
- **Thanh tiến trình (Progress Bar):** Hiển thị trạng thái % trực quan cho các tác vụ nặng: Import Bulk JSON, Xóa toàn bộ dữ liệu, Đồng bộ lịch sử.
- **Collapsible Debug Tools:** Thu gọn các bảng tính toán chi tiết (TWRR, Tổng tài sản) để giao diện trang Tổng quan gọn gàng, chuyên nghiệp hơn.
- **Real-time Feedback:** Hiển thị chi tiết trạng thái đang xử lý mã tài sản nào trong quá trình nhập liệu.

---

## [1.0.0] - Phiên bản gốc (Quản lý số dư cơ bản)

### ✨ Tính năng chính
- **Quản lý tài sản:** Hỗ trợ thêm/sửa/xóa nguồn tiền (Ngân hàng, Ví điện tử) và tài sản (Chứng khoán, Crypto).
- **Tổng tài sản:** Tính toán tổng giá trị danh mục dựa trên số lượng hiện có và giá thị trường nhập thủ công.
- **Phân bổ tài sản:** Biểu đồ tròn hiển thị tỷ lệ tài sản theo danh mục (Tiền mặt, Chứng khoán, Khác) và nền tảng.
- **Lịch sử giao dịch:** Danh sách ghi chép các lệnh mua/bán cơ bản.
- **Đồng bộ giá:** Tải giá hiện tại của các mã chứng khoán/crypto thông qua API.
