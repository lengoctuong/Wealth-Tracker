import { useState, useEffect } from "react";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { marketService, PriceResult } from "../services/marketService";

export interface MarketData {
  price: number;
  change: number;
  changePercent: number;
  date: string;
}

export interface MarketHistory {
  date: string;
  price: number;
}

export const useMarketData = (startDate?: string | null) => {
  const [vnIndex, setVnIndex] = useState<MarketData | null>(null);
  const [vnIndexHistory, setVnIndexHistory] = useState<MarketHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncingMarketData, setIsSyncingMarketData] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "marketData", "VNINDEX"), (docSnap) => {
      try {
        if (docSnap.exists()) {
          const dbData = docSnap.data();
          if (dbData && dbData.history && dbData.history.length > 0) {
            // Sort history to make sure it's chronological
            const sortedHistory = [...dbData.history].sort((a: any, b: any) => 
               a.timestamp.localeCompare(b.timestamp)
            );

            // Filter out 0 values and weekends
            const validData = sortedHistory.filter(d => {
               // Append T00:00:00 to keep local time timezone bugs away if parsing
               const date = new Date(d.timestamp + "T00:00:00");
               const day = date.getDay();
               return d.value > 0 && day !== 0 && day !== 6; 
            });

            if (validData.length > 0) {
              const latest = validData[validData.length - 1];
              const previous = validData.length > 1 ? validData[validData.length - 2] : latest;
              const change = latest.value - previous.value;
              const changePercent = previous.value !== 0 ? (change / previous.value) * 100 : 0;

              setVnIndex({
                price: latest.value,
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                date: latest.timestamp
              });

              setVnIndexHistory(validData.map(d => ({
                date: d.timestamp,
                price: d.value
              })));
            }
          }
        }
      } catch (error) {
        console.error("Failed to parse VNINDEX from DB", error);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Error listening to VNINDEX:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [startDate]); // startDate here might not even be strictly needed for filtering if we just show all DB history, but we can keep it in dependency array or use it to slice.


  const syncMarketPrices = async (symbols: { symbol: string, type: string }[], earliestDate: string) => {
    setIsSyncingMarketData(true);
    try {
      const latestPrices: Record<string, number> = {};
      const resultsToSave: { ticker: string, history: PriceResult[] }[] = [];

      const fetchSymbol = async ({ symbol, type }: { symbol: string, type: string }) => {
        let history: PriceResult[] | null = null;
        let needsNgrok = true;

        // Try getting from DB first
        const docSnap = await getDoc(doc(db, "marketData", symbol));
        if (docSnap.exists()) {
          const dbData = docSnap.data();
          if (dbData && dbData.history && dbData.history.length > 0) {
            history = dbData.history.map((h: any) => ({
              timestamp: h.timestamp + "T00:00:00",
              value: h.value
            }));
            
            // Check if DB data covers the required period
            const sortedHistory = [...history].sort((a,b) => a.timestamp.localeCompare(b.timestamp));
            const latestDataStr = sortedHistory[sortedHistory.length - 1].timestamp;
            const earliestDataStr = sortedHistory[0].timestamp;
            
            const latestDataDate = new Date(latestDataStr);
            const now = new Date();
            const diffDays = (now.getTime() - latestDataDate.getTime()) / (1000 * 3600 * 24);
            
            // It's "fresh enough" ONLY if it's recent AND covers the required early date
            if (diffDays <= 3 && earliestDataStr <= earliestDate) {
              needsNgrok = false; 
            }
          }
        }

        if (needsNgrok) {
          if (type === 'crypto') {
            history = await marketService.getCryptoHistory(symbol, earliestDate);
          } else if (type === 'fund') {
            history = await marketService.getFundHistory(symbol, earliestDate);
          } else {
            history = await marketService.getStockHistory(symbol, earliestDate);
          }
          
          if (history && history.length > 0) {
            resultsToSave.push({ ticker: symbol, history });
          }
        }
        
        if (history && history.length > 0) {
          // Find latest price
          const sortedHistory = [...history].sort((a,b) => a.timestamp.localeCompare(b.timestamp));
          latestPrices[symbol] = sortedHistory[sortedHistory.length - 1].value;
        }
      };

      const chunkSize = 5;
      for (let i = 0; i < symbols.length; i += chunkSize) {
        const chunk = symbols.slice(i, i + chunkSize);
        await Promise.all(chunk.map(fetchSymbol));
      }

      // Save new ngrok fetches to Firebase
      for (const res of resultsToSave) {
        await setDoc(doc(db, "marketData", res.ticker), {
          ticker: res.ticker,
          history: res.history.map(h => ({
            timestamp: h.timestamp.split('T')[0],
            value: h.value
          })),
          updatedAt: new Date().toISOString()
        });
      }

      return latestPrices;
    } catch (error) {
      console.error("Failed to sync market prices", error);
      return null;
    } finally {
      setIsSyncingMarketData(false);
    }
  };

  return { vnIndex, vnIndexHistory, loading, syncMarketPrices, isSyncingMarketData };
};
