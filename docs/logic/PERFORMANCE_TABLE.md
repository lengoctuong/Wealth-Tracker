# Logic Tính Toán Hiệu Suất (Performance Table)

Tài liệu này giải thích công thức tính toán trong bảng **"So sánh hiệu suất theo kỳ"** tại trang Dashboard.

---

## 1. Công thức tính cho từng Mã tài sản (Asset)

Hiệu suất của mỗi mã trong một kỳ (Tuần hoặc Tháng) được tính để phản ánh biến động giá trị túi tiền thực tế, bao gồm cả các giao dịch mua/bán phát sinh.

### Công thức:
$$Performance = \frac{V_{end}}{V_{start}} - 1$$

Trong đó:
*   **$V_{start}$ (Giá trị đầu kỳ):** `(Số dư đầu kỳ × Giá ngày trước đó) + Tổng tiền mua trong kỳ`.
*   **$V_{end}$ (Giá trị cuối kỳ):** `(Số dư cuối kỳ × Giá ngày cuối kỳ) + Tổng tiền thu về khi bán trong kỳ`.

### Ví dụ minh họa:
Giả sử bạn đang xem hiệu suất **Tháng 3** của mã **HPG**:
*   **Case A (Mua thêm):** Đầu tháng có 100 CP (giá 20k). Ngày 15/3 mua thêm 50 CP (giá 22k). Cuối tháng giá là 25k.
    - $V_{start} = (100 \times 20.000) + (50 \times 22.000) = 3.100.000đ$.
    - $V_{end} = (150 \times 25.000) + 0 = 3.750.000đ$.
    - **Hiệu suất:** $(3.750.000 / 3.100.000) - 1 = +20,9\%$.
*   **Case B (Bán sạch):** Đầu tháng có 100 CP (giá 20k). Ngày 15/3 bán sạch 100 CP (giá 25k).
    - $V_{start} = (100 \times 20.000) + 0 = 2.000.000đ$.
    - $V_{end} = (0 \times \text{giá}) + (100 \times 25.000) = 2.500.000đ$.
    - **Hiệu suất:** $(2.500.000 / 2.000.000) - 1 = +25\%$.

---

## 2. Logic dòng "Tổng hợp" (Group Summary)

Dòng này tính toán hiệu quả dựa trên **Tổng Vốn và Tổng Tài sản** của toàn bộ nhóm tài khoản (ví dụ: Tổng nhóm Chứng khoán), không phải là trung bình cộng đơn thuần.

### Cách tính:
1.  **Tổng $V_{start}$ nhóm:** Cộng dồn tất cả giá trị đầu kỳ của các mã trong nhóm.
2.  **Tổng $V_{end}$ nhóm:** Cộng dồn tất cả giá trị cuối kỳ của các mã trong nhóm.
3.  **Hiệu suất Tổng hợp:** `(Tổng V_end nhóm / Tổng V_start nhóm) - 1`.

---

---

## 4. Lưu ý quan trọng về cách tính

### Trọng số vốn (Capital Weighting)
*   **6 cột giá trị đầu kỳ (Tuần/Tháng):** Các con số này **tự động scale theo giá trị đầu tư**. Vì công thức tính dựa trên Tổng Giá trị ($V_{end}/V_{start}$), nên các mã có tỷ trọng vốn lớn sẽ đóng góp mức độ ảnh hưởng lớn hơn vào dòng "Tổng hợp nhóm" và "Tổng hiệu suất toàn bộ".
*   Ví dụ: Nếu mã A (vốn 1 tỷ) lãi 1% và mã B (vốn 10 triệu) lãi 50%, thì tổng hiệu suất chung sẽ nghiêng về mã A (xấp xỉ 1%) thay vì là trung bình cộng (25,5%).

### Cột Tổng cộng (Compounded Total)
*   Cột cuối cùng là **tổng hợp lãi kép** thuần túy của 6 cột trước đó. 
*   **Logic:** Hệ thống lấy các tỷ suất lợi nhuận đã được scale của từng kỳ và nhân dồn chúng lại: $R_{total} = [(1 + r_1) \times (1 + r_2) \times ... \times (1 + r_6)] - 1$.
*   **Ý nghĩa:** Cột này coi mỗi kỳ là một "phân đoạn đóng góp" tương đương nhau về mặt thời gian. Nó giúp bạn thấy được sức mạnh của lãi kép qua 6 chu kỳ mà không bị làm loãng bởi việc thay đổi quy mô vốn quá lớn giữa các tháng (ví dụ: tháng cuối bạn nạp thêm rất nhiều tiền cũng không làm thay đổi hiệu suất xuất sắc của các tháng đầu).
