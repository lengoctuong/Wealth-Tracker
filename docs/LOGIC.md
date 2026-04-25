# Tài liệu Logic Xử lý Tài chính (FIFO, Backfill & TWRR)

Tài liệu này mô tả chi tiết quy trình 3 giai đoạn để đồng bộ dữ liệu, tính toán lợi nhuận và tái dựng lịch sử tài sản trong ứng dụng Wealth Tracker.

---

## Tổng quan quy trình
Khi người dùng kích hoạt lệnh **"Đồng bộ lịch sử"**, hệ thống sẽ thực hiện tuần tự 3 bước sau:
1. **Bước 1 (Rebuild FIFO):** Khớp lệnh Mua/Bán và xác định giá vốn.
2. **Bước 2 (Backfill History):** Duyệt lại lịch sử để tính tổng tài sản và vốn ròng từng ngày.
3. **Bước 3 (Calculate TWRR):** Tính toán % tăng trưởng loại bỏ ảnh hưởng của dòng tiền.

---

## 1. Bước 1: Rebuild FIFO (First-In First-Out)

Hàm này xử lý sự tương quan giữa các lệnh Mua và Bán để xác định giá vốn cho các khoản đầu tư đã chốt lời/lỗ.

### A. Input (Dữ liệu đầu vào)
Toàn bộ bản ghi từ Collection `investment_transactions` của người dùng, được sắp xếp theo `date ASC` và `createdAt ASC`.

### B. Logic xử lý
Hệ thống duyệt qua danh sách giao dịch của từng mã tài sản:
1. **Nếu là lệnh MUA:** Khởi tạo lớp tồn kho mới với số dư ban đầu bằng chính số lượng mua.
2. **Nếu là lệnh BÁN:** 
    - Tìm các lớp lệnh MUA sớm nhất còn tồn kho.
    - Trừ dần số lượng bán vào số dư của các lệnh Mua đó.
    - Tính **Giá vốn trung bình** của các lô hàng vừa khớp.

### C. Tương tác Database
- **Collection tác động:** `investment_transactions`.
- **Cập nhật:**
    - `remainingQty`: Cập nhật số lượng còn lại cho các lệnh Mua.
    - `isClosed`: Đánh dấu `true` cho các lệnh Mua đã bị bán hết.
    - `purchasePrice`: Ghi giá vốn vừa tính được vào lệnh Bán tương ứng.

---

## 2. Bước 2: Backfill History (Hồi tố lịch sử)

Sử dụng kết quả từ Bước 1 để tính toán giá trị tài sản ròng và vốn ròng cho mọi ngày trong quá khứ.

### A. Input
1. `investment_transactions`: Đã được cập nhật đầy đủ giá vốn ở Bước 1.
2. `marketData`: Lịch sử giá thị trường của từng mã tài sản.

### B. Logic xử lý (Iterative Calculation)
Hệ thống chạy một vòng lặp từ ngày có giao dịch đầu tiên đến hiện tại. Với mỗi ngày:
1. **Tính `totalCost` (Vốn đầu tư ròng):**
    - Nếu Mua: `Vốn = Vốn + (Số lượng mua * Giá mua)`.
    - Nếu Bán: `Vốn = Vốn - (Số lượng bán * Giá vốn trung bình tại thời điểm đó)`.
    - *Mục đích:* `totalCost` chỉ đại diện cho số vốn của những gì **đang nắm giữ**.
2. **Tính `totalValue` (Giá trị thị trường):**
    - `Giá trị = Số lượng nắm giữ * Giá thị trường của ngày đó`.

### C. Tương tác Database
- **Collection tác động:** `assetHistory`.
- **Hành động:** Xóa toàn bộ dữ liệu cũ của người dùng trong bảng này và ghi đè dữ liệu mới.
- **Cấu trúc bản ghi:**
    ```typescript
    {
      date: string;       // YYYY-MM-DD
      accountId: string;  // Phân tách theo từng sàn/tài khoản
      totalValue: number; // Tổng giá trị thị trường
      totalCost: number;  // Vốn đầu tư ròng của phần chưa bán
      profit: number;     // Value - Cost
      realizedProfit: number; // Lãi/lỗ đã chốt trong ngày (nếu có bán)
    }
    ```

---

## 3. Bước 3: Tính toán TWRR (Time-Weighted Rate of Return)

Đây là bước tính toán hiệu suất tăng trưởng thực tế, loại bỏ sự nhiễu loạn từ việc nộp/rút tiền.

### A. Input
1. Dữ liệu chuỗi thời gian từ bảng `assetHistory`.
2. Dòng tiền (`CashFlow`) nộp/rút mỗi ngày trích xuất từ các lệnh Mua/Bán.

### B. Logic xử lý
Hệ thống tính toán lợi nhuận tích lũy qua từng ngày:
1. **Tỷ suất lợi nhuận kỳ (`r`):**
   `r = (V_cuối_ngày - Dòng_tiền_trong_ngày - V_ngày_trước) / V_ngày_trước`
2. **Lợi nhuận tích lũy (TWRR):**
   `R_tích_lũy = (1 + r1) * (1 + r2) * ... - 1`

### C. Output (Dữ liệu vẽ biểu đồ)
Tạo ra một mảng dữ liệu cung cấp cho thư viện Recharts:
```typescript
{
  date: "2024-04-25",
  valuePct: 15.5,    // % tăng trưởng tích lũy để vẽ biểu đồ
  vnIndexPct: 10.2,  // So sánh với VN-Index
  twrrDetails: { ... } // Chi tiết các biến để hiện Tooltip
}
```

---

*Lưu ý: Toàn bộ các bước trên là logic tính toán nội bộ của ứng dụng (Internal Client-side Logic), tương tác trực tiếp với Firebase Firestore để đảm bảo dữ liệu luôn nhất quán và chính xác.*
