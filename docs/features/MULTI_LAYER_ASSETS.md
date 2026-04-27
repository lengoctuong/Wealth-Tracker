# 🛡️ Chiến lược Quản lý Đa lớp Tài sản (Multi-layer Asset Management)

Hệ thống Wealth Tracker được thiết kế dựa trên triết lý **Quản lý đa lớp tài sản**, giúp bạn không chỉ theo dõi con số tổng mà còn hiểu sâu về hiệu quả của từng danh mục đầu tư và mức độ an toàn của tài sản tích lũy.

---

## 1. Lớp Tài sản Đầu tư (Growth & Trading Layer)
Đây là lớp tài sản quan trọng nhất để gia tăng giá trị tài sản ròng. Hệ thống tập trung vào việc tính toán hiệu suất thực tế dựa trên các biến động thị trường.

### Danh mục Tag phân loại:
| Tên hiển thị | Tag (Mã hệ thống) | Ý nghĩa kỹ thuật |
| :--- | :--- | :--- |
| **Chứng khoán** | `stock` | Cổ phiếu cơ sở (VNStock/Yahoo Finance) |
| **ETF** | `etf` | Chứng chỉ quỹ hoán đổi danh mục |
| **Tiền điện tử** | `coin` | Các loại Token/Coin (Binance/Coingecko) |
| **Quỹ mở** | `fund` | Chứng chỉ quỹ mở hoặc quỹ đầu tư |

### Đặc tính kỹ thuật & Nghiệp vụ:
- **Tối ưu hóa Giá vốn (FIFO)**: Sử dụng thuật toán "Nhập trước - Xuất trước" để tính toán chính xác giá vốn còn lại và lợi nhuận thực tế (Realized P/L).
- **Theo dõi Hiệu suất (TWRR)**: Tính toán tỷ suất lợi nhuận loại bỏ dòng tiền nạp/rút.
- **Tự động hóa**: Tự động kết nối Backend để cập nhật giá theo thời gian thực dựa trên **Symbol**.

---

## 2. Lớp Tài sản Ổn định & Thanh khoản (Liquidity Layer)
Lớp tài sản này đóng vai trò là "tấm khiên" bảo vệ tài chính, tập trung vào tính an toàn và thanh khoản nhanh.

### Danh mục Tag phân loại:
| Tên hiển thị | Tag (Mã hệ thống) | Ý nghĩa kỹ thuật |
| :--- | :--- | :--- |
| **Tiền mặt** | `cash` | Tiền mặt, tài khoản thanh toán, ví điện tử |
| **Tiết kiệm** | `saving` | Tiền gửi có kỳ hạn hoặc không kỳ hạn |
| **Bot Trading** | `bot` | Vốn ủy thác giao dịch tự động |
| **Vị thế** | `position` | Các vị thế Polymarket |

### Đặc tính kỹ thuật & Nghiệp vụ:
- **Quản lý Số dư (Balance-based)**: Không cần lịch sử giao dịch chi tiết, chỉ theo dõi biến động số dư (`balance`) và vốn gốc (`purchasePrice`).
- **Theo dõi Lãi suất**: Hỗ trợ cột `interestRate` riêng cho các khoản gửi tiết kiệm.
- **Tính ổn định**: Không tự động đồng bộ giá thị trường (Static Data).

---

## 3. Các quy tắc chuẩn hóa dữ liệu
Để đảm bảo hệ thống vận hành trơn tru, quy tắc sau được áp dụng:
- **Cấu trúc JSON**: Khi Xuất/Nhập dữ liệu, hệ thống dựa vào các **Tag** ở trên để phân bổ dữ liệu vào đúng luồng xử lý (FIFO cho Investment, Balance cho Static).

---
*Mô hình đa lớp giúp bạn luôn kiểm soát được "Sức khỏe tài chính" của mình một cách chuyên nghiệp nhất.*
