# Logic tính toán các chỉ số (Metrics) tại Trang Tổng quan

Dựa trên các chỉ số hiển thị trong bộ Dashboard:

## 1. Tổng Tài Sản Ròng (Net Worth)
- **Công thức:** `Tổng (Giá trị thị trường của từng tài sản * Tỷ giá quy đổi sang VND)`.
- **Dữ liệu:** Lấy từ số dư cuối cùng của tất cả các tài khoản.

## 2. Biến động theo kỳ (30 ngày, 6 tháng, 1 năm, 3 năm)
Đây là chỉ số hiệu suất đã loại trừ nhiễu từ việc nạp/rút tiền.
- **Công thức:** `Lãi/Lỗ kỳ = (Giá trị hiện tại - Dòng tiền nạp ròng trong kỳ) - Giá trị đầu kỳ`.
- **Lý do:** Nếu không loại trừ "Dòng tiền nạp ròng", việc bạn nạp thêm tiền sẽ làm % biến động tăng ảo, không phản ánh đúng trình độ đầu tư.

## 3. Tổng Lãi/Lỗ (Total Profit)
- **Công thức:** `Tổng Lãi = Tổng giá trị tài sản hiện tại - Tổng vốn đầu tư ròng (Cumulative Cash Flow)`.
- **TWRR % (Time-Weighted Rate of Return):** Tính toán tỷ suất lợi nhuận bình quân theo thời gian, loại bỏ ảnh hưởng của các khoản nạp/rút lớn giữa kỳ. Đây là chuẩn quốc tế để đánh giá trình độ của người quản lý quỹ.

## 4. Lãi Tạm Tính (Unrealized Profit)
- **Vị trí:** Hiển thị kèm % hiệu suất của danh mục hiện tại.
- **Công thức tiền mặt:** `Tổng [(Giá hiện tại - Giá vốn MA/FIFO) * Số lượng đang giữ]`.
- **Công thức %:** `(Tổng lãi tạm tính / Tổng giá vốn các mã đang giữ) * 100`.
- **Ý nghĩa:** Cho biết nếu "chốt sổ" ngay bây giờ, bạn sẽ lãi bao nhiêu % trên số vốn đang nằm trong thị trường.

## 5. Lãi Đã Chốt (Realized Profit)
- **Công thức:** `Lãi đã chốt = Tổng Lãi - Lãi Tạm Tính`.
- **Ý nghĩa:** Tổng hợp tất cả lợi nhuận từ các lệnh bán đã thực hiện trong quá khứ.

## 6. Tỷ lệ Tiền mặt (Cash Ratio)
- **Công thức:** `(Tổng giá trị các tài sản thuộc nhóm Cash, Tiết kiệm, USDT / Tổng tài sản ròng) * 100`.
- **Ý nghĩa:** Giúp người dùng quản trị rủi ro, biết mình đang "full cổ" hay đang cầm nhiều tiền mặt để chờ cơ hội.
