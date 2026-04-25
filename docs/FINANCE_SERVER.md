# Finance Server API (Python Backend)

Đây là server hỗ trợ cung cấp dữ liệu tài chính thời gian thực và lịch sử cho Wealth Tracker, giải quyết vấn đề CORS và giới hạn API trực tiếp từ trình duyệt.

## 🚀 Chức năng chính
- **vnstock:** Lấy dữ liệu lịch sử giá Chứng khoán Việt Nam và các chứng chỉ quỹ (NAV).
- **yfinance:** Lấy dữ liệu Crypto (BTC, ETH,...) và chứng khoán quốc tế.
- **Gold Crawler:** Tự động crawl giá vàng SJC, PNJ, DOJI từ các nguồn như `giavang.org` và `webgia.com`.
- **Caching:** Hỗ trợ lưu trữ dữ liệu vàng vào CSV để truy xuất nhanh.

## 🛠 Công nghệ sử dụng
- **Ngôn ngữ:** Python 3.8+
- **Framework:** FastAPI
- **Thư viện chính:**
  - `vnstock`: Dữ liệu tài chính Việt Nam.
  - `yfinance`: Dữ liệu tài chính quốc tế.
  - `pandas`: Xử lý dữ liệu.
  - `BeautifulSoup4`: Crawl dữ liệu web.

## 📡 Các Endpoints chính
| Endpoint | Method | Params | Mô tả |
|----------|--------|--------|-------|
| `/api/vnstock` | GET | `ticker`, `is_fund`, `start`, `end` | Lấy lịch sử giá CP/Quỹ (VN) |
| `/api/yfinance` | GET | `ticker`, `start`, `end` | Lấy lịch sử giá Crypto/Global Stock |
| `/api/vngold` | GET | `gold_type`, `price_type`, `start`, `end` | Lấy giá vàng từ cache CSV |
| `/api/vngold/update` | POST | `gold_type` | Kích hoạt crawl cập nhật giá vàng |

## 📊 Chi tiết Schema dữ liệu

### 1. Dữ liệu Lịch sử Giá (VNStock, YFinance, Gold)
Tất cả các endpoint trả về lịch sử giá đều dùng chung một cấu trúc danh sách:

**Response (JSON):**
```json
[
  {
    "timestamp": "2024-05-20T00:00:00",
    "value": 1250.5
  },
  {
    "timestamp": "2024-05-21T00:00:00",
    "value": 1260.0
  }
]
```
- `timestamp`: Chuỗi ISO 8601 định dạng ngày giờ.
- `value`: Giá trị (giá đóng cửa hoặc giá NAV) tại thời điểm đó.

### 2. Dữ liệu Cập nhật Giá Vàng
Khi gọi các endpoint update (`/api/vngold/update`), server sẽ trả về trạng thái xử lý:

**Response (JSON):**
```json
{
  "status": "success",
  "message": "Đã cập nhật thêm 5 dòng dữ liệu.",
  "latest_date": "2024-05-25",
  "added_dates": ["2024-05-21", "2024-05-22", "..."]
}
```

## ⚙️ Cấu hình dữ liệu
Dữ liệu vàng được lưu trữ tại:
- `./data/sjc_gold_full_sources_backup.csv`
- `./data/pnj_gold_mieng_giavang_org_backup.csv`
- `./data/doji_gold_backup.csv`
