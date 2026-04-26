# Bước 3: Tính toán TWRR (Time-Weighted Rate of Return)

Đây là bước tính toán hiệu suất tăng trưởng thực tế, loại bỏ sự nhiễu loạn từ việc nộp/rút tiền.

## A. Input
1. Dữ liệu chuỗi thời gian từ bảng `assetHistory`.
2. Dòng tiền (`CashFlow`) nộp/rút mỗi ngày trích xuất từ các lệnh Mua/Bán.

## B. Logic xử lý
Hệ thống tính toán lợi nhuận tích lũy qua từng ngày:
1. **Tỷ suất lợi nhuận kỳ (`r`):**
   `r = (V_cuối_ngày - Dòng_tiền_trong_ngày - V_ngày_trước) / V_ngày_trước`
2. **Lợi nhuận tích lũy (TWRR):**
   `R_tích_lũy = (1 + r1) * (1 + r2) * ... - 1`

## C. Ví dụ minh họa (TWRR Calculation)

Giả sử bạn bắt đầu với **100.000.000đ**:
1. **Giai đoạn 1 (Ngày 1 -> Ngày 10):** Tài sản tăng lên 110 triệu (Lãi 10%).
   - $r_1 = \frac{110 - 100}{100} = 0.1$ (10%)
2. **Sự kiện Dòng tiền (Ngày 11):** Bạn nạp thêm **50.000.000đ**. Tổng tài sản lúc này là 160 triệu.
3. **Giai đoạn 2 (Ngày 11 -> Ngày 20):** Tài sản từ 160 triệu tăng lên 176 triệu (Lãi 10% trên vốn mới).
   - $r_2 = \frac{176 - 50 - 110}{110} = 0.1$ (10%)
   - *Giải thích:* Chúng ta trừ đi dòng tiền nạp (50tr) để chỉ tính phần tăng trưởng thực từ 110tr lên 126tr.
4. **TWRR Tổng hợp:**
   - $R_{total} = [(1 + 0.1) \times (1 + 0.1)] - 1 = 0.21$ (21%).

**Kết luận:** Dù bạn nạp thêm tiền làm tổng tài sản tăng vọt, TWRR vẫn chỉ báo cáo mức tăng trưởng thực tế là 21%.

## D. Output (Dữ liệu vẽ biểu đồ)
Tạo ra một mảng dữ liệu cung cấp cho thư viện Recharts:
```typescript
{
  date: "2024-04-25",
  valuePct: 15.5,    // % tăng trưởng tích lũy để vẽ biểu đồ
  vnIndexPct: 10.2,  // So sánh với VN-Index
  twrrDetails: { ... } // Chi tiết các biến để hiện Tooltip
}
```
