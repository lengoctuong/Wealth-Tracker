import { useState, useEffect } from "react";
import { marketService } from "../services/marketService";

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

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const backendUrl = marketService.getBackendUrl();
        
        // Use provided startDate or default to 30 days ago
        let fetchStartDate = startDate;
        if (!fetchStartDate) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          fetchStartDate = thirtyDaysAgo.toISOString().split('T')[0];
        }

        // Format yyyy-mm-dd to dd-mm-yyyy for Python backend
        const [y, m, d] = fetchStartDate.split('-');
        const formattedStartDate = `${d}-${m}-${y}`;

        const historyRes = await fetch(
          `${backendUrl}/api/vnstock?ticker=VNINDEX&start=${formattedStartDate}`,
          {
            headers: {
              "ngrok-skip-browser-warning": "true",
              "Accept": "application/json",
            }
          }
        );
        
        if (historyRes.ok) {
          const data: any[] = await historyRes.json();
          // Filter out 0 values (weekends or errors) and also filter out weekends (Sat, Sun)
          const validData = data.filter(d => {
            const date = new Date(d.timestamp);
            const day = date.getDay();
            return d.value > 0 && day !== 0 && day !== 6; // 0 is Sunday, 6 is Saturday
          });
          
          if (validData && validData.length > 0) {
            const latest = validData[validData.length - 1];
            const previous = validData.length > 1 ? validData[validData.length - 2] : latest;
            const change = latest.value - previous.value;
            const changePercent = (change / previous.value) * 100;

            setVnIndex({
              price: latest.value,
              change: Number(change.toFixed(2)),
              changePercent: Number(changePercent.toFixed(2)),
              date: latest.timestamp.split('T')[0]
            });

            setVnIndexHistory(validData.map(d => ({
              date: d.timestamp.split('T')[0],
              price: d.value
            })));
          }
        }
      } catch (error) {
        console.error("Failed to fetch market data from Python backend", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  return { vnIndex, vnIndexHistory, loading };
};
