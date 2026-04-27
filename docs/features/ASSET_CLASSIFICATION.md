# Phân loại và Logic Tài sản (Asset Classification)

Tài liệu này mô tả cách hệ thống phân loại các loại tài sản, logic tính toán đi kèm và cách hiển thị trên giao diện người dùng.

## 1. Nhóm Tài sản Đầu tư (Investment Assets)
Nhóm này dành cho các tài sản có biến động giá liên tục và được quản lý dựa trên lịch sử giao dịch.

| Category (Mã DB) | Tên hiển thị | Ý nghĩa |
| :--- | :--- | :--- |
| `stock` | Cổ phiếu | Chứng khoán cơ sở (Thị trường Việt Nam) |
| `etf` | ETF | Chứng chỉ quỹ hoán đổi danh mục |
| `fund` | Quỹ mở / CCQ | Quỹ mở (Fintech) hoặc Chứng chỉ quỹ (Sàn CK) |
| `coin` | Coin / Token | Tiền điện tử (BTC, ETH, Altcoins...) |

### Logic tính toán & Hiển thị
- **Dữ liệu đầu vào**: Danh sách các giao dịch (Buy/Sell).
- **Logic Giá vốn**: Áp dụng phương pháp **FIFO (First-In-First-Out)** để tính giá vốn còn lại và lợi nhuận đã thực hiện (Realized Profit).
- **Đồng bộ giá**: Hệ thống tự động gọi Backend (Python API) để lấy giá thị trường mới nhất.
- **Vị trí hiển thị**: Tab **Fintech**, **Chứng khoán**, **Crypto**.
- **Icon**: Sử dụng các icon chuyên biệt (Coins, TrendingUp, Landmark...).

---

## 2. Nhóm Tài sản Tĩnh (Static Assets)
Nhóm này dành cho các tài sản có giá trị ổn định hoặc được cập nhật thủ công, không cần theo dõi chi tiết từng lệnh mua/bán nhỏ lẻ.

| Category (Mã DB) | Tên hiển thị | Ý nghĩa |
| :--- | :--- | :--- |
| `cash` | Tiền mặt | Tiền mặt, tiền trong ví điện tử, tài khoản ngân hàng thanh toán |
| `saving` | Tiết kiệm | Các khoản tiền gửi tiết kiệm có kỳ hạn hoặc không kỳ hạn |
| `bot` | Bot Trading | Các tài khoản giao dịch tự động (chỉ theo dõi tổng số dư) |


### Logic tính toán & Hiển thị
- **Dữ liệu đầu vào**: Số dư hiện tại (`balance`) và Giá trị gốc (`purchasePrice`).
- **Logic Giá vốn**: Không tính FIFO. Thay đổi giá trị = Số dư hiện tại - Giá trị gốc.
- **Đồng bộ giá**: **Không** gọi Backend. Người dùng cập nhật giá trị thủ công.
- **Vị trí hiển thị**: Tab **Ngân hàng**, **Ví điện tử**, **Fintech**, **Chứng khoán**, **Crypto**, **Khác***.
- **Icon**: Sử dụng icon ví tiền hoặc ngân hàng.

---

## 3. Quy tắc đồng bộ dữ liệu (Sync Logic)
Hệ thống chỉ thực hiện lấy giá thị trường cho các tài sản thỏa mãn điều kiện:
1. Có Symbol (Mã).
2. Chưa kết thúc (`isFinished === false`).
3. Thuộc nhóm **Đầu tư** (`stock`, `etf`, `coin`, `fund`).

---

## 5. Cấu trúc JSON Export/Import
Để đảm bảo tính di động, dữ liệu xuất ra được chuẩn hóa theo dạng phân cấp:
- **Đầu tư**: Xuất theo cấu trúc `Tài sản -> Danh sách Giao dịch`.
- **Tài sản khác**: Xuất theo cấu trúc `Tài sản -> Số dư/Vốn gốc`.
