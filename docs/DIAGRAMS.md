# System Diagrams

Tài liệu này chứa các sơ đồ luồng dữ liệu và tương tác giữa các thành phần trong hệ thống Wealth Tracker.

## 1. Sơ đồ kiến trúc tổng quát (System Flowchart)

Sơ đồ này mô tả cách các thành phần giao tiếp với nhau để lấy dữ liệu thị trường và lưu trữ dữ liệu người dùng.

```mermaid
graph TD
    User((Người dùng))
    
    subgraph "Frontend (React + Vite)"
        UI[Giao diện người dùng]
        Hooks[Custom Hooks: useAssets, useMarketData]
        Service[MarketService]
    end
    
    subgraph "Storage & Auth"
        Firebase[(Firebase Firestore)]
        Auth[Firebase Auth]
    end
    
    subgraph "Backend Layer"
        Proxy[Express Proxy Server: Port 3000]
        Python[Python Backend: Ngrok]
    end
    
    subgraph "Data Sources"
        VNStock[Vnstock API]
        YF[Yahoo Finance API]
        Gold[Gold Price]
    end

    User --> UI
    UI <--> Hooks
    UI <--> Auth
    Hooks <--> Firebase
    Hooks --> Service
    
    Service --> Proxy
    Proxy --> Python
    
    Python --> VNStock
    Python --> YF
    Python --> Gold
```

## 2. Luồng đồng bộ giá thị trường (Sequence Diagram)

Sơ đồ này mô tả quy trình cập nhật giá hiện tại cho các tài sản.

**Kích hoạt khi:** 
1. Người dùng nhấn nút **"Lưu giá thị trường vào DB"** trong Cài đặt.
2. Hoặc sau khi thực hiện **"Bulk Import"** thành công.

```mermaid
sequenceDiagram
    participant UI as Dashboard UI
    participant Hook as useMarketData
    participant MS as marketService
    participant Py as Python Backend
    participant DB as Firestore [marketData]
    
    UI->>Hook: Trigger Sync / Load
    Hook->>MS: getStockPrice(symbol)
    MS->>Py: GET /api/vnstock?ticker=...
    Py-->>MS: Trả về dữ liệu giá (JSON)
    MS-->>Hook: Trả về giá mới nhất
    Hook->>DB: Lưu vào Collection 'marketData' (Upsert)
    Note over Hook, DB: Lưu lịch sử giá để vẽ biểu đồ
    Hook-->>UI: Cập nhật State & re-render UI
```

## 3. Luồng xử lý giao dịch & FIFO (Sequence Diagram)

Mô tả cách hệ thống xử lý dữ liệu tài chính khi có biến động về giao dịch.

**Kích hoạt khi:**
1. Người dùng nhập lệnh **Mua/Bán lẻ** trong Modal giao dịch.
2. Người dùng thực hiện **Bulk Import JSON** (Hệ thống tự động kích hoạt sau khi hoàn tất).
3. Người dùng nhấn **"Đồng bộ lịch sử"** trên trang Tổng quan để tính toán lại toàn bộ.

```mermaid
sequenceDiagram
    participant UI as Transaction UI
    participant Hook as useTransactions
    participant FIFO as FIFO Logic (Utils)
    participant DB as Firestore [investment_transactions / assets]
    participant Dash as Dashboard
    
    UI->>Hook: Add Transaction (Buy/Sell)
    Hook->>DB: Ghi vào 'investment_transactions'
    
    alt Nếu là lệnh BÁN hoặc Đồng bộ lại
        Hook->>FIFO: Rebuild FIFO layers (sort by date)
        FIFO-->>Hook: Trả về giá vốn (avg price) & lãi đã chốt
        Hook->>DB: Cập nhật 'remainingQty' & 'isClosed' trong 'investment_transactions'
    end
    
    Hook->>DB: Cập nhật số dư/giá vốn trong Collection 'assets'
    Hook-->>Dash: Refresh dữ liệu trang Dashboard
    Dash->>Dash: Tính toán lại TWRR (Time-Weighted)
```

## 4. Phân cấp dữ liệu (Data Hierarchy)

```mermaid
erDiagram
    USER ||--o{ ACCOUNT : owns
    ACCOUNT ||--o{ ASSET : contains
    ASSET ||--o{ TRANSACTION : has
    ASSET ||--o{ HISTORY : tracks
    USER {
        string uid
        string email
    }
    ACCOUNT {
        string id
        string name
        string type
    }
    ASSET {
        string id
        string symbol
        string category
        float quantity
        float currentPrice
    }
    TRANSACTION {
        string id
        string type
        float quantity
        float price
        date date
    }
```
