# Database Documentation (Firestore)

Dự án sử dụng Google Firebase Firestore làm cơ sở dữ liệu NoSQL. Cấu trúc dữ liệu được tổ chức theo các Collection chính sau:

## 1. Collection `accounts`
Lưu trữ thông tin về các nguồn tài sản (Ngân hàng, Sàn chứng khoán, Ví...).

| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | string | ID của người dùng (Firebase Auth) |
| `name` | string | Tên nguồn tài sản (ví dụ: "VNDIRECT", "Vietcombank") |
| `type` | string | Loại: `bank`, `brokerage`, `crypto`, `fintech`, `ewallet`, `other` |
| `createdAt` | string | Thời gian tạo (ISO format) |

## 2. Collection `assets`
Lưu trữ danh sách các tài sản. Lưu ý: Với tài sản đầu tư, một số trường sẽ được tính toán từ giao dịch thay vì lưu trực tiếp.

| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | string | ID của người dùng |
| `accountId` | string | ID của account chứa tài sản này |
| `category` | string | Phân loại: `stock`, `coin`, `saving`, `cash`, `fund`... |
| `name` | string | Tên tài sản (ví dụ: "FPT", "Bitcoin") |
| `symbol` | string | Mã tài sản (không bắt buộc với tiền mặt) |
| `currency` | string | Loại tiền tệ (VND, USD, USDT...) |
| `currentPrice` | number | Giá thị trường hiện tại (chủ yếu cho đầu tư) |
| `balance` | number | Số dư (dùng cho Tiền mặt / Ví điện tử) |
| `interestRate` | number | Lãi suất (dùng cho Tiền gửi tiết kiệm) |
| `purchasePrice` | number | Giá vốn (được tính từ FIFO, không lưu trực tiếp cho đầu tư) |
| `quantity` | number | Số lượng (được tính từ giao dịch, không lưu trực tiếp cho đầu tư) |
| `isFinished` | boolean | `true` nếu tài sản đã bán hết hoặc tất toán |
| `updatedAt` | string | Thời điểm cập nhật cuối cùng |

## 3. Collection `investment_transactions`
Lưu trữ lịch sử giao dịch Mua/Bán của các tài sản đầu tư. Đây là bảng quan trọng để tính toán FIFO.

| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | string | ID của người dùng |
| `assetId` | string | ID của tài sản liên quan |
| `type` | string | `buy` hoặc `sell` |
| `quantity` | number | Số lượng giao dịch |
| `price` | number | Giá tại thời điểm giao dịch |
| `date` | string | Ngày giao dịch (YYYY-MM-DD) |
| `remainingQty` | number | Số lượng còn lại chưa bán (chỉ áp dụng cho lệnh `buy`) |
| `isClosed` | boolean | `true` nếu lệnh mua đã được bán hết |
| `purchasePrice` | number | Giá vốn khớp lệnh (chỉ áp dụng cho lệnh `sell`) |
| `createdAt` | string | Thời điểm tạo giao dịch (ISO format) |

## 4. Collection `assetHistory`
Lưu trữ chuỗi giá trị tài sản theo thời gian (kết quả của hàm Backfill). Đây là nguồn dữ liệu chính để vẽ biểu đồ và tính TWRR.

| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | string | ID của người dùng |
| `accountId` | string | ID của tài khoản (giúp lọc biểu đồ theo từng sàn) |
| `date` | string | Ngày (YYYY-MM-DD) |
| `totalValue` | number | Tổng giá trị tài sản ngày đó (Số lượng x Giá thị trường) |
| `totalCost` | number | Vốn đầu tư ròng của các tài sản đang giữ ngày đó |
| `profit` | number | Lãi/Lỗ tạm tính ngày đó (`totalValue - totalCost`) |
| `realizedProfit` | number | Lợi nhuận đã chốt trong ngày đó (nếu có bán) |
| `vnIndex` | number | Giá VN-Index ngày đó |
| `timestamp` | string | Thời điểm tạo bản ghi |

## 5. Collection `marketData`
Lưu trữ dữ liệu lịch sử giá từ các API bên ngoài để tăng tốc độ hiển thị biểu đồ.

| Field | Type | Description |
| :--- | :--- | :--- |
| `symbol` | string | Mã chứng khoán/Crypto (ví dụ: "VNINDEX", "HPG") |
| `history` | array | Mảng các object `{ date, price }` |
| `lastUpdated` | string | Thời điểm cập nhật cuối cùng |

## 6. Collection `settings`
Lưu trữ cấu hình cá nhân của người dùng.

| Field | Type | Description |
| :--- | :--- | :--- |
| `usdtRate` | number | Tỷ giá USDT/VND do người dùng thiết lập |
| `vnIndexPrice` | number | Giá VN-INDEX (nếu người dùng muốn nhập thủ công) |
| `backendUrl` | string | URL của Python Backend (ngrok) |
