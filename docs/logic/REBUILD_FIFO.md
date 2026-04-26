# Bước 1: Rebuild FIFO (First-In First-Out)

Hàm này xử lý sự tương quan giữa các lệnh Mua và Bán để xác định giá vốn cho các khoản đầu tư đã chốt lời/lỗ.

## A. Input (Dữ liệu đầu vào)
Toàn bộ bản ghi từ Collection `investment_transactions` của người dùng, được sắp xếp theo `date ASC` và `createdAt ASC`.

## B. Logic xử lý
Hệ thống duyệt qua danh sách giao dịch của từng mã tài sản:
1. **Nếu là lệnh MUA:** Khởi tạo lớp tồn kho mới với số dư ban đầu bằng chính số lượng mua.
2. **Nếu là lệnh BÁN:** 
    - Tìm các lớp lệnh MUA sớm nhất còn tồn kho.
    - Trừ dần số lượng bán vào số dư của các lệnh Mua đó.
    - Tính **Giá vốn trung bình** của các lô hàng vừa khớp.

## C. Tương tác Database
- **Collection tác động:** `investment_transactions`.
- **Cập nhật:**
    - `remainingQty`: Cập nhật số lượng còn lại cho các lệnh Mua.
    - `isClosed`: Đánh dấu `true` cho các lệnh Mua đã bị bán hết.
    - `purchasePrice`: Ghi giá vốn vừa tính được vào lệnh Bán tương ứng.

## D. Ví dụ minh họa (Example)

Giả sử bạn giao dịch mã **HPG**:
1. **Ngày 01/01:** Mua 100 CP giá 20.000đ.
    - FIFO Queue: `[{ qty: 100, price: 20000 }]`
2. **Ngày 05/01:** Mua 50 CP giá 22.000đ.
    - FIFO Queue: `[{ qty: 100, price: 20000 }, { qty: 50, price: 22000 }]`
3. **Ngày 10/01:** Bán 120 CP giá 25.000đ.
    - Hệ thống sẽ lấy 100 CP từ lô đầu tiên và 20 CP từ lô thứ hai.
    - **Giá vốn (Purchase Price) của lệnh bán này:**
      $$\frac{(100 \times 20.000) + (20 \times 22.000)}{120} = 20.333đ$$
    - FIFO Queue còn lại: `[{ qty: 30, price: 22000 }]` (Lô 1 đã đóng - isClosed: true).
