# Bước 2: Backfill History (Hồi tố lịch sử)

Sử dụng kết quả từ Bước 1 để tính toán giá trị tài sản ròng và vốn ròng cho mọi ngày trong quá khứ.

## A. Input
1. `investment_transactions`: Đã được cập nhật đầy đủ giá vốn ở Bước 1.
2. `marketData`: Lịch sử giá thị trường của từng mã tài sản.

## B. Logic xử lý (Iterative Calculation)
Hệ thống chạy một vòng lặp từ ngày có giao dịch đầu tiên đến hiện tại. Với mỗi ngày:
1. **Tính `totalCost` (Vốn đầu tư ròng):**
    - Nếu Mua: `Vốn = Vốn + (Số lượng mua * Giá mua)`.
    - Nếu Bán: `Vốn = Vốn - (Số lượng bán * Giá vốn trung bình tại thời điểm đó)`.
    - *Mục đích:* `totalCost` chỉ đại diện cho số vốn của những gì **đang nắm giữ**.
2. **Tính `totalValue` (Giá trị thị trường):**
    - `Giá trị = Số lượng nắm giữ * Giá thị trường của ngày đó`.

## C. Tương tác Database
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

## D. Ví dụ minh họa (Portfolio Evolution)
Tiếp tục với ví dụ mã **HPG** ở Bước 1:
*   **Ngày 01/01 (Mua 100 CP giá 20k, giá TT 20k):**
    - `totalCost` = 2.000.000đ
    - `totalValue` = 100 * 20.000 = 2.000.000đ.
*   **Ngày 02/01 (Không giao dịch, giá TT tăng lên 21k):**
    - `totalCost` = 2.000.000đ (Vốn không đổi).
    - `totalValue` = 100 * 21.000 = 2.100.000đ.
    - `profit` = +100.000đ.
*   **Ngày 10/01 (Bán 120 CP giá 25k, giá TT 25k):**
    - Giá vốn TB (từ FIFO) = 20.333đ.
    - `totalCost` giảm đi: `120 * 20.333 = 2.440.000đ`.
    - `totalValue` còn lại: `30 * 25.000 = 750.000đ`.
    - `realizedProfit` (Lãi đã chốt): `120 * (25.000 - 20.333) = 560.000đ`.
