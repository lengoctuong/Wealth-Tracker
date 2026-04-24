import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy for VN Stock Prices (Simulated or real if available)
  // For now, we'll mock some data or use a public API if possible.
  app.get("/api/stocks/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const response = await fetch(`https://finfo-api.vndirect.com.vn/v4/stock_prices?q=code:${symbol.toUpperCase()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        // VNDirect returns prices in thousands (e.g., 25.5 = 25,500 VND)
        const currentPrice = data.data[0].matchPrice * 1000;
        res.json({ symbol: symbol.toUpperCase(), price: currentPrice });
      } else {
        // Fallback for common stocks if API fails or returns empty
        const mockPrices: Record<string, number> = {
          'HPG': 28500, 'VCB': 92000, 'FPT': 115000, 'VIC': 45000, 'VNM': 68000, 'TCB': 35000
        };
        const price = mockPrices[symbol.toUpperCase()] || (20000 + Math.random() * 10000);
        res.json({ symbol: symbol.toUpperCase(), price: Math.round(price) });
      }
    } catch (error) {
      console.error("Error fetching stock:", error);
      const mockPrices: Record<string, number> = {
        'HPG': 28500, 'VCB': 92000, 'FPT': 115000, 'VIC': 45000, 'VNM': 68000, 'TCB': 35000
      };
      const price = mockPrices[req.params.symbol.toUpperCase()] || (20000 + Math.random() * 10000);
      res.json({ symbol: req.params.symbol.toUpperCase(), price: Math.round(price) });
    }
  });

  app.get("/api/market/vnindex", async (req, res) => {
    try {
      const response = await fetch(`https://finfo-api.vndirect.com.vn/v4/stock_prices?q=code:VNINDEX`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        const matchPrice = data.data[0].matchPrice;
        const change = data.data[0].change;
        const changePercent = Number(((change / (matchPrice - change)) * 100).toFixed(2));
        res.json({ price: matchPrice, change: change, changePercent: changePercent, date: new Date().toLocaleString('vi-VN') });
      } else {
        // Fallback to mock data if API returns empty
        const mockPrice = 1250 + (Math.random() * 10 - 5);
        res.json({ price: Number(mockPrice.toFixed(2)), change: 1.5, changePercent: 0.12, date: new Date().toLocaleString('vi-VN') });
      }
    } catch (error) {
      console.error("Error fetching VNINDEX:", error);
      // Fallback to mock data on error
      const mockPrice = 1250 + (Math.random() * 10 - 5);
      res.json({ price: Number(mockPrice.toFixed(2)), change: 1.5, changePercent: 0.12, date: new Date().toLocaleString('vi-VN') });
    }
  });

  app.get("/api/market/history/vnindex", async (req, res) => {
    try {
      // Mock historical data for VNINDEX for the last 30 days
      const history = [];
      let basePrice = 1250;
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        basePrice = basePrice + (Math.random() * 20 - 9); // slight upward bias
        history.push({
          date: date.toISOString().split('T')[0],
          price: Number(basePrice.toFixed(2))
        });
      }
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
