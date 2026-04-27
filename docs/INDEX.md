# 📑 Wealth Tracker Documentation Index

Chào mừng bạn đến với hệ thống tài liệu của dự án Wealth Tracker. Dưới đây là danh mục toàn bộ tài liệu để bạn nắm bắt dự án:

## 🧭 Hướng dẫn bắt đầu
- [**Hướng dẫn sử dụng (USER_GUIDE.md)**](./USER_GUIDE.md): Cách thiết lập app, cấu hình Backend và nhập liệu cho người dùng mới.
- [**Lịch sử thay đổi (CHANGELOG.md)**](./CHANGELOG.md): Theo dõi các phiên bản và các tính năng mới cập nhật.

## ⚙️ Logic xử lý cốt lõi
Quy trình 3 bước đồng bộ dữ liệu:
- [**Bước 1: Rebuild FIFO**](./logic/REBUILD_FIFO.md) - Khớp lệnh mua/bán và tính giá vốn.
- [**Bước 2: Backfill History**](./logic/BACKFILL_HISTORY.md) - Hồi tố lịch sử tài sản từng ngày.
- [**Bước 3: Calculate TWRR**](./logic/CALCULATE_TWRR.md) - Tính tỷ suất lợi nhuận loại bỏ dòng tiền.

- [**Cách tính giá MA (CALCULATE_MA_PRICE.md)**](./logic/CALCULATE_MA_PRICE.md): Logic giá vốn cho Tab Chứng khoán.
- [**Chỉ số trang Tổng quan (OVERVIEW_METRICS.md)**](./logic/OVERVIEW_METRICS.md): Giải thích các chỉ số Net Worth, P/L, Cash Ratio.
- [**Logic Bảng Hiệu suất (PERFORMANCE_TABLE.md)**](./logic/PERFORMANCE_TABLE.md): Giải thích công thức tính toán trên Dashboard.
- [**Phân loại Tài sản (ASSET_CLASSIFICATION.md)**](./features/ASSET_CLASSIFICATION.md): Chi tiết về các loại tài sản và quy tắc tính toán (FIFO vs Static).

## 🏗️ Kiến trúc & Hệ thống
- [**Kiến trúc tổng quát (ARCHITECTURE.md)**](./ARCHITECTURE.md): Tổng quan về Tech Stack, cấu trúc thư mục và các khái niệm cốt lõi.
- [**Sơ đồ hệ thống (DIAGRAMS.md)**](./DIAGRAMS.md): Các biểu đồ Mermaid về luồng dữ liệu (Flowchart, Sequence Diagram).

## 🗄️ Dữ liệu & API
- [**Cấu trúc Database (DATABASE.md)**](./DATABASE.md): Chi tiết các Collection và Schema trong Firebase Firestore.
- [**Tài liệu API chung (API.md)**](./API.md): Danh sách các Endpoint của hệ thống.
- [**Finance Server (FINANCE_SERVER.md)**](./FINANCE_SERVER.md): Tài liệu riêng cho Python Backend lấy giá thị trường.

## 🗺️ Sơ đồ File & Thư mục quan trọng (v2.4)

```text
src
├── components
│   ├── tabs
│   │   ├── InvestmentTab.tsx
│   │   ├── OverviewTab.tsx
│   │   └── StandardTab.tsx
│   ├── AddAccountModal.tsx
│   ├── AddAssetModal.tsx
│   ├── BulkImportModal.tsx
│   ├── Dashboard.tsx
│   └── ... (modals & widgets)
├── hooks
│   ├── useAccounts.ts
│   ├── useAssetHistory.ts
│   ├── useAssets.ts
│   ├── useMarketData.ts
│   └── useTransactions.ts
├── lib
│   └── utils.ts
├── App.tsx
└── main.tsx
```

### 🖥️ Giao diện & Điều khiển (UI)
| File Path | Chức năng chính |
| :--- | :--- |
| `src/components/Dashboard.tsx` | **Trình điều khiển chính (Orchestrator)**. Quản lý trạng thái, đồng bộ giá và điều hướng tab. |
| `src/components/tabs/OverviewTab.tsx` | **Trang Tổng quan**. Hiển thị biểu đồ tài sản và tóm tắt danh mục. |
| `src/components/tabs/InvestmentTab.tsx` | **Tab Đầu tư**. Quản lý Cổ phiếu, Coin, ETF (Logic FIFO). |
| `src/components/tabs/StandardTab.tsx` | **Tab Tài sản khác**. Quản lý Tiền mặt, Tiết kiệm, Bot (Logic Số dư). |

### 🧠 Logic & Xử lý dữ liệu (Hooks)
| File Path | Vai trò logic |
| :--- | :--- |
| `src/hooks/useTransactions.ts` | Chứa logic **FIFO** và quản lý giao dịch đầu tư. |
| `src/hooks/useAssetHistory.ts` | Chứa logic **Backfill** để vẽ biểu đồ lịch sử tài sản. |
| `src/hooks/useMarketData.ts` | Quản lý việc đồng bộ giá từ Backend và Cache dữ liệu. |
| `src/lib/utils.ts` | Từ điển nhãn tài sản và các hàm format dữ liệu. |

### 📂 Thư mục khác
- `src/contexts/`: Quản lý Auth và State toàn cục.
- `src/services/`: Các dịch vụ kết nối Firebase và API bên ngoài.
- `src/ui/`: Các UI components dùng chung (Shadcn UI).

---
*Tài liệu này được tổ chức lại để giúp việc tra cứu và bảo trì mã nguồn trở nên dễ dàng hơn.*
