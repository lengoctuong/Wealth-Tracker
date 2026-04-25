
let PYTHON_BACKEND_URL = "http://localhost:8000";

// Ngrok free tier requires this header to skip the browser warning page
const fetchHeaders = {
  "ngrok-skip-browser-warning": "true",
  "Accept": "application/json",
};

export interface PriceData {
  timestamp: string;
  value: number;
}

export interface PriceResult {
  value: number;
  timestamp: string;
}

export const marketService = {
  setBackendUrl(url: string) {
    PYTHON_BACKEND_URL = url;
  },

  getBackendUrl() {
    return PYTHON_BACKEND_URL;
  },

  async getStockPrice(ticker: string, startDate?: string): Promise<PriceResult | null> {
    const history = await this.getStockHistory(ticker, startDate);
    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      return {
        value: latest.value,
        timestamp: latest.timestamp
      };
    }
    return null;
  },

  async getStockHistory(ticker: string, startDate?: string): Promise<PriceResult[] | null> {
    try {
      const url = new URL(`${PYTHON_BACKEND_URL}/api/vnstock`);
      url.searchParams.append("ticker", ticker);
      if (startDate) {
        // Format yyyy-mm-dd to dd-mm-yyyy
        const [y, m, d] = startDate.split('-');
        url.searchParams.append("start", `${d}-${m}-${y}`);
      }

      const response = await fetch(url.toString(), {
        headers: fetchHeaders
      });
      if (!response.ok) return null;
      const data: PriceData[] = await response.json();
      if (data && data.length > 0) {
        // Stock and ETF prices need to be multiplied by 1000, but NOT VNINDEX
        const isVnIndex = ticker.toUpperCase() === 'VNINDEX';
        return data.map(d => ({
          value: isVnIndex ? d.value : d.value * 1000,
          timestamp: d.timestamp
        }));
      }
      return null;
    } catch (error) {
      console.error(`Error fetching stock price for ${ticker}:`, error);
      return null;
    }
  },

  async getFundPrice(ticker: string, startDate?: string): Promise<PriceResult | null> {
    const history = await this.getFundHistory(ticker, startDate);
    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      return {
        value: latest.value,
        timestamp: latest.timestamp
      };
    }
    return null;
  },

  async getFundHistory(ticker: string, startDate?: string): Promise<PriceResult[] | null> {
    try {
      const url = new URL(`${PYTHON_BACKEND_URL}/api/vnstock`);
      url.searchParams.append("ticker", ticker);
      url.searchParams.append("is_fund", "true");
      if (startDate) {
        // Format yyyy-mm-dd to dd-mm-yyyy
        const [y, m, d] = startDate.split('-');
        url.searchParams.append("start", `${d}-${m}-${y}`);
      }

      const response = await fetch(url.toString(), {
        headers: fetchHeaders
      });
      if (!response.ok) return null;
      const data: PriceData[] = await response.json();
      if (data && data.length > 0) {
        return data.map(d => ({
          value: d.value,
          timestamp: d.timestamp
        }));
      }
      return null;
    } catch (error) {
      console.error(`Error fetching fund price for ${ticker}:`, error);
      return null;
    }
  },

  async getCryptoPrice(ticker: string, startDate?: string): Promise<PriceResult | null> {
    const history = await this.getCryptoHistory(ticker, startDate);
    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      return {
        value: latest.value,
        timestamp: latest.timestamp
      };
    }
    return null;
  },

  async getCryptoHistory(ticker: string, startDate?: string): Promise<PriceResult[] | null> {
    try {
      const url = new URL(`${PYTHON_BACKEND_URL}/api/yfinance`);
      url.searchParams.append("ticker", ticker);
      if (startDate) {
        // Format yyyy-mm-dd to dd-mm-yyyy
        const [y, m, d] = startDate.split('-');
        url.searchParams.append("start", `${d}-${m}-${y}`);
      }

      const response = await fetch(url.toString(), {
        headers: fetchHeaders
      });
      if (!response.ok) return null;
      const data: PriceData[] = await response.json();
      if (data && data.length > 0) {
        return data.map(d => ({
          value: d.value,
          timestamp: d.timestamp
        }));
      }
      return null;
    } catch (error) {
      console.error(`Error fetching crypto price for ${ticker}:`, error);
      return null;
    }
  },

  async getGoldPrice(goldType: string = "sjc", priceType: string = "sell", startDate?: string): Promise<PriceResult | null> {
    const history = await this.getGoldHistory(goldType, priceType, startDate);
    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      return {
        value: latest.value,
        timestamp: latest.timestamp
      };
    }
    return null;
  },

  async getGoldHistory(goldType: string = "sjc", priceType: string = "sell", startDate?: string): Promise<PriceResult[] | null> {
    try {
      const url = new URL(`${PYTHON_BACKEND_URL}/api/vngold`);
      url.searchParams.append("gold_type", goldType);
      url.searchParams.append("price_type", priceType);
      if (startDate) {
        // Format yyyy-mm-dd to dd-mm-yyyy
        const [y, m, d] = startDate.split('-');
        url.searchParams.append("start", `${d}-${m}-${y}`);
      }

      const response = await fetch(url.toString(), {
        headers: fetchHeaders
      });
      if (!response.ok) return null;
      const data: PriceData[] = await response.json();
      if (data && data.length > 0) {
        return data.map(d => ({
          value: d.value,
          timestamp: d.timestamp
        }));
      }
      return null;
    } catch (error) {
      console.error(`Error fetching gold price for ${goldType}:`, error);
      return null;
    }
  }
};
