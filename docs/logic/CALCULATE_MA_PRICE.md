# Logic tính Giá vốn Bình quân (Moving Average - MA)

## 1. Vị trí trong Code
- **File:** `src/hooks/useAssets.ts`
- **Hàm:** `mergedAssets` (sử dụng `useMemo`)

## 2. Công thức tính
Giá vốn MA được tính toán lũy kế dựa trên toàn bộ lịch sử giao dịch:

- **Khi MUA:** 
  `Giá MA mới = (Giá MA cũ * Số lượng cũ + Giá mua mới * Số lượng mua mới) / (Số lượng cũ + Số lượng mua mới)`
- **Khi BÁN:** 
  `Giá MA mới = Giá MA cũ` (Không thay đổi giá vốn khi bán, chỉ giảm số lượng).
- **Khi BÁN HẾT:**
  `Giá MA = 0` (Reset về 0 khi số lượng bằng 0).

## 3. Lý do áp dụng
- **Chuẩn thị trường VN:** Hầu hết các công ty chứng khoán tại Việt Nam (VNDIRECT, SSI, VPS...) sử dụng phương pháp MA để hiển thị giá vốn trên app cho khách hàng dễ theo dõi điểm hòa vốn.
- **Phân tách UI và Core:** 
  - **UI:** Dùng MA để người dùng đối chiếu khớp với App chứng khoán.
  - **Core (Backend):** Vẫn duy trì logic FIFO để tính toán lợi nhuận TWRR và thuế phí chuẩn xác theo kế toán.

## 4. Đối tượng áp dụng
- Chỉ áp dụng cho danh mục thuộc **Tab Chứng khoán** (Category: `stock`, `etf`).
- Các danh mục Crypto và Fintech vẫn sử dụng chuẩn **FIFO** để bám sát biến động từng lô tài sản.

## 5. Ví dụ thực tế (Mã FUEVFVND)
Giả sử có chuỗi giao dịch sau:
1. **Mua đợt 1:** 100 @ 31,260 => `Giá MA = 31,260`
2. **Mua đợt 2:** 100 @ 31,130 => `Giá MA = (31,260*100 + 31,130*100) / 200 = 31,195`
3. **Mua đợt 3:** 40 @ 25,480 => `Giá MA = (31,195*200 + 25,480*40) / 240 = 30,242.5`
4. **Bán đợt 1:** Bán 90 cổ phiếu => `Giá MA = 30,242.5` (Bán không đổi giá vốn)
5. **Bán đợt 2:** Bán 70 cổ phiếu => `Giá MA = 30,242.5` (Bán không đổi giá vốn)
6. **Mua đợt 4:** Mua 20 @ 36,000
   - Lượng cũ còn: 80 @ 30,242.5
   - Lượng mới: 20 @ 36,000
   - `Giá MA mới = (30,242.5*80 + 36,000*20) / 100 = 31,394`

**Kết quả hiển thị trên UI:** Giá vốn MA = **31,394**
