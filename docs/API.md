# API Documentation

The Wealth Tracker application uses two layers of APIs:
1. **Frontend Express Server**: Proxies requests and serves the app.
2. **Python Backend**: Fetches real-time and historical market data.

## Python Backend Endpoints (Ngrok)

### 1. Stock & Fund Data
- **Endpoint**: `GET /api/vnstock`
- **Parameters**:
  - `ticker` (string): The stock symbol (e.g., `HPG`, `VNM`).
  - `is_fund` (boolean, optional): Set to `true` for open-ended funds.
  - `start` (string, optional): Start date in `dd-mm-yyyy` format.
- **Response**: List of `{ timestamp, value }` objects.

### 2. Crypto Data
- **Endpoint**: `GET /api/yfinance`
- **Parameters**:
  - `ticker` (string): The crypto symbol (e.g., `BTC-USD`, `ETH-USD`).
  - `start` (string, optional): Start date in `dd-mm-yyyy` format.
- **Response**: List of `{ timestamp, value }` objects.

### 3. Gold Prices
- **Endpoint**: `GET /api/vngold`
- **Parameters**:
  - `gold_type` (string): Type of gold (e.g., `sjc`, `pnj`).
  - `price_type` (string): `buy` or `sell`.
- **Response**: List of `{ timestamp, value }` objects.

## Frontend Server Endpoints (Port 3000)

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Response**: `{ status: "ok" }`

### 2. Market Overview
- **Endpoint**: `GET /api/market/vnindex`
- **Response**: Current VN-INDEX price, change, and change percentage.

### 3. Historical Market Data
- **Endpoint**: `GET /api/market/history/vnindex`
- **Response**: 30-day historical data for VN-INDEX.
