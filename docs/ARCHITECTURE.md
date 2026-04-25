# Architecture & Technical Details

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite.
- **Styling**: Tailwind CSS, Shadcn UI.
- **Charts**: Recharts.
- **Backend (API)**: Express.js (serving as a proxy and static file host).
- **Backend (Python)**: A separate Python service (often run via ngrok) for fetching stock, crypto, and market index data.
- **Database**: Firebase Firestore (for storing accounts, assets, and transactions).
- **Authentication**: Firebase Auth (Google Sign-In).

## Key Logic

### 1. TWRR (Time-Weighted Rate of Return)
The application calculates performance using the Time-Weighted Rate of Return to eliminate the impact of cash inflows and outflows (deposits/withdrawals).
- **Formula**: `r = (V_current - CF - V_prev) / V_prev`
- **Cumulative Return**: `(1 + r1) * (1 + r2) * ... * (1 + rn) - 1`

**Ví dụ:**
- **Ngày 1:** Bạn có 100tr. Cuối ngày tài sản tăng lên 110tr (lãi 10%).
- **Ngày 2:** Bạn nộp thêm 50tr. Tổng tài sản lúc này là 160tr. Cuối ngày tài sản giảm còn 152tr (lỗ 5% so với mức 160tr).
- **Kết quả TWRR:** Hiệu suất sẽ là `(1 + 10%) * (1 - 5%) - 1 = 4.5%`. TWRR phản ánh đúng biến động thị trường, không bị ảnh hưởng bởi việc bạn nộp thêm 50tr.

### 2. FIFO (First-In, First-Out)
For investment assets (stocks, coins), the app uses FIFO to calculate:
- **Remaining Quantity**: Tracking which purchase lots are still held.
- **Unrealized P/L**: Calculated by comparing the current market price with the average purchase price of remaining lots.
- **Realized P/L**: Calculated when a sell transaction occurs, matching it against the oldest available purchase lots.

**Ví dụ:**
- **Lệnh 1:** Mua 100 HPG giá 20.000.
- **Lệnh 2:** Mua 100 HPG giá 30.000.
- **Lệnh 3:** Bán 150 HPG giá 35.000.
- **Tính toán theo FIFO:**
    - Bán hết 100 cổ của Lệnh 1 (giá vốn 20.000).
    - Bán tiếp 50 cổ của Lệnh 2 (giá vốn 30.000).
    - **Lợi nhuận đã chốt (Realized P/L):** `(100 * (35-20)) + (50 * (35-30)) = 1.750.000`.
    - **Tài sản còn lại:** 50 cổ HPG với giá vốn 30.000.

### 3. Market Data Synchronization
- Stock prices for the VN market are fetched via the Python backend.
- Crypto prices are fetched via `yfinance` in the Python backend.
- Historical data is synced and stored in a `marketData` collection in Firestore to improve dashboard performance.

## Directory Structure
- `src/components`: UI components organized by feature (tabs, ui, modals).
- `src/hooks`: Custom hooks for data management (assets, accounts, transactions).
- `src/services`: Services for external API calls and configuration.
- `src/contexts`: React contexts (e.g., AuthContext).
- `src/lib/utils.ts`: Core utility functions for currency formatting and financial calculations.
