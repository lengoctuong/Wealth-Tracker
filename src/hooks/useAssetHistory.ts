import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, doc, getDocs, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../utils/firestoreErrorHandler";
import { Asset } from "./useAssets";
import { getAssetValue } from "../lib/utils";
import { InvestmentTransaction, useInvestmentTransactions } from "./useTransactions";
import { marketService, PriceResult } from "../services/marketService";

export interface AssetHistory {
  id: string;
  userId: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  totalValue: number;
  totalCost: number;
  profit: number;
  vnIndex: number;
  timestamp: string;
}

export const useAssetHistory = (assets: Asset[], vnIndexValue: number | null, usdtRate: number = 25500) => {
  const { user } = useAuth();
  const { transactions: investmentTransactions } = useInvestmentTransactions();
  const [history, setHistory] = useState<AssetHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState(0);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "assetHistory"), where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: AssetHistory[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as AssetHistory);
        });
        setHistory(data);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "assetHistory");
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Function to take a daily snapshot
  const snapshotPortfolio = async (customDate?: string, customVnIndex?: number) => {
    if (!user || assets.length === 0) return;
    
    const now = new Date();
    const day = now.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (!customDate && (day === 0 || day === 6)) return;
    
    const targetDate = customDate || now.toISOString().split('T')[0];
    
    try {
      // Check if snapshot already exists for this date
      const q = query(
        collection(db, "assetHistory"), 
        where("userId", "==", user.uid),
        where("date", "==", targetDate)
      );
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      
      // Calculate realized profit for today
      const realizedProfitToday = investmentTransactions
        .filter(tx => tx.type === 'sell' && tx.date === targetDate)
        .reduce((sum, tx) => sum + (tx.quantity * (tx.price - (tx.purchasePrice || 0))), 0);

      // Group investment assets by account
      const accountData: Record<string, { value: number, cost: number }> = {};
      assets.forEach(asset => {
        // Only include investment assets
        if (!["stock", "etf", "coin", "fund", "crypto"].includes(asset.category)) return;
        
        const valueInVnd = getAssetValue(asset, usdtRate);
        const isUsd = ['USD', 'USDT', 'USDC'].includes(asset.currency?.toUpperCase());
        const costInVnd = (asset.purchasePrice || 0) * (asset.quantity || 0) * (isUsd ? usdtRate : 1);
        
        if (!accountData[asset.accountId]) {
          accountData[asset.accountId] = { value: 0, cost: 0 };
        }
        accountData[asset.accountId].value += valueInVnd;
        accountData[asset.accountId].cost += costInVnd;
      });
      
      // Calculate realized profit for targetDate
      const realizedProfitByAccount: Record<string, number> = {};
      investmentTransactions.filter(tx => tx.date === targetDate && tx.type === 'sell').forEach(tx => {
        const asset = assets.find(a => a.id === tx.assetId);
        if (!asset) return;
        const purchasePrice = tx.purchasePrice || asset.purchasePrice || 0;
        if (purchasePrice === 0) return;
        const profit = (tx.price - purchasePrice) * tx.quantity * (['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase()) ? (usdtRate || 1) : 1);
        realizedProfitByAccount[asset.accountId] = (realizedProfitByAccount[asset.accountId] || 0) + profit;
      });

      // Create new snapshots
      Object.entries(accountData).forEach(([accountId, data]) => {
        const newRef = doc(collection(db, "assetHistory"));
        batch.set(newRef, {
          userId: user.uid,
          accountId,
          date: targetDate,
          totalValue: data.value,
          totalCost: data.cost,
          realizedProfit: realizedProfitByAccount[accountId] || 0,
          profit: data.value - data.cost,
          vnIndex: customVnIndex !== undefined ? customVnIndex : (vnIndexValue || 0),
          timestamp: new Date().toISOString()
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error("Failed to snapshot portfolio", error);
    }
  };

  const backfillHistory = async (investmentTransactions: InvestmentTransaction[]) => {
    if (!user || investmentTransactions.length === 0) return;
    setIsBackfilling(true);
    setBackfillProgress(0);

    try {
      // 1. Find the earliest transaction date
      const sortedTxs = [...investmentTransactions].sort((a, b) => a.date.localeCompare(b.date));
      const startDateStr = sortedTxs[0].date;
      const startDate = new Date(startDateStr);
      const today = new Date();
      
      // Calculate total days for progress
      const totalDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      let processedDays = 0;

      // 2. Fetch historical prices from DB for all symbols and VN-Index
      const tickers = Array.from(new Set(assets.filter(a => a.symbol).map(a => a.symbol!)));
      const priceHistoryMap: Record<string, PriceResult[]> = {};
      let vnIndexHistory: PriceResult[] | null = null;
      
      const vnSnap = await getDoc(doc(db, "marketData", "VNINDEX"));
      if (vnSnap.exists()) {
        const data = vnSnap.data();
        if (data && data.history) {
           vnIndexHistory = data.history.map((h: any) => ({
             timestamp: h.timestamp + "T00:00:00",
             value: h.value
           }));
        }
      }

      for (const ticker of tickers) {
        if (!ticker) continue;
        const snap = await getDoc(doc(db, "marketData", ticker));
        if (snap.exists()) {
          const data = snap.data();
          if (data && data.history) {
            priceHistoryMap[ticker] = data.history.map((h: any) => ({
              timestamp: h.timestamp + "T00:00:00",
              value: h.value
            }));
          }
        }
      }

      // 3. Delete old history first
      const oldHistoryQ = query(collection(db, "assetHistory"), where("userId", "==", user.uid));
      const oldHistorySnapshot = await getDocs(oldHistoryQ);
      let deleteBatch = writeBatch(db);
      let deleteCount = 0;
      
      for (const docSnap of oldHistorySnapshot.docs) {
        deleteBatch.delete(docSnap.ref);
        deleteCount++;
        if (deleteCount >= 400) {
          await deleteBatch.commit();
          deleteBatch = writeBatch(db);
          deleteCount = 0;
        }
      }
      if (deleteCount > 0) await deleteBatch.commit();

      // 4. Iterate day by day and create new snapshots
      let currentDate = new Date(startDate);
      let currentBatch = writeBatch(db);
      let batchCount = 0;
      let lastVnIndex = 0;
      
      // Track last known price for each ticker to handle data gaps (especially for funds)
      const lastKnownPrices: Record<string, number> = {};
      
      while (currentDate <= today) {
        const day = currentDate.getDay();
        // Skip Saturday (6) and Sunday (0)
        if (day === 0 || day === 6) {
          currentDate.setDate(currentDate.getDate() + 1);
          processedDays++;
          setBackfillProgress(Math.round((processedDays / totalDays) * 100));
          continue;
        }

        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Calculate holdings on this date
        const holdings: Record<string, { quantity: number, cost: number, asset: Asset }> = {};
        
        // Filter transactions up to this date
        const txsToDate = investmentTransactions.filter(tx => tx.date <= dateStr);
        
        // Calculate quantity and cost for each asset
        txsToDate.forEach(tx => {
          const asset = assets.find(a => a.id === tx.assetId);
          if (!asset) return;
          
          if (!holdings[tx.assetId]) {
            holdings[tx.assetId] = { quantity: 0, cost: 0, asset };
          }
          
          if (tx.type === 'buy') {
            holdings[tx.assetId].quantity += tx.quantity;
            holdings[tx.assetId].cost += tx.quantity * tx.price;
          } else {
            const avgCost = holdings[tx.assetId].quantity > 0 ? holdings[tx.assetId].cost / holdings[tx.assetId].quantity : 0;
            holdings[tx.assetId].quantity -= tx.quantity;
            holdings[tx.assetId].cost -= tx.quantity * avgCost;
          }
        });

        // Calculate realized profit for this date, grouped by account
        const realizedProfitByAccount: Record<string, number> = {};
        investmentTransactions
          .filter(tx => tx.type === 'sell' && tx.date === dateStr)
          .forEach(tx => {
            const asset = assets.find(a => a.id === tx.assetId);
            if (!asset) return;
            
            // Find avg price before this transaction
            const txsBefore = investmentTransactions.filter(t => 
              t.assetId === tx.assetId && 
              (t.date < tx.date || (t.date === tx.date && t.createdAt < tx.createdAt))
            );
            
            let qty = 0;
            let cost = 0;
            txsBefore.forEach(t => {
              if (t.type === 'buy') {
                qty += t.quantity;
                cost += t.quantity * t.price;
              } else {
                const avg = qty > 0 ? cost / qty : 0;
                qty -= t.quantity;
                cost -= t.quantity * avg;
              }
            });
            
            const avgPrice = qty > 0 ? cost / qty : 0;
            const rate = ['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase()) ? (usdtRate || 1) : 1;
            const profit = (tx.price - avgPrice) * tx.quantity * rate;
            realizedProfitByAccount[asset.accountId] = (realizedProfitByAccount[asset.accountId] || 0) + profit;
          });

        // Calculate total value and cost for each account
        const accountData: Record<string, { value: number, cost: number, realizedProfit: number }> = {};
        
        // Initialize accountData for all accounts that have transactions up to this date
        const activeAccounts = new Set<string>();
        txsToDate.forEach(tx => {
          const asset = assets.find(a => a.id === tx.assetId);
          if (asset) activeAccounts.add(asset.accountId);
        });
        
        activeAccounts.forEach(accountId => {
          accountData[accountId] = { value: 0, cost: 0, realizedProfit: 0 };
        });
        
        Object.values(holdings).forEach(({ quantity, cost, asset }) => {
          if (quantity <= 0) return;
          
          const ticker = asset.symbol;
          const prices = ticker ? priceHistoryMap[ticker] : null;
          const priceObj = prices?.find(p => p.timestamp.startsWith(dateStr));
          
          // Logic: Use current date price if available, otherwise use last known price, 
          // fallback to asset's current/purchase price if it's the first time
          let price = 0;
          if (priceObj && priceObj.value > 0) {
            price = priceObj.value;
            if (ticker) lastKnownPrices[ticker] = price;
          } else if (ticker && lastKnownPrices[ticker]) {
            price = lastKnownPrices[ticker];
          } else {
            price = asset.currentPrice || asset.purchasePrice || 0;
            if (ticker && price > 0) lastKnownPrices[ticker] = price;
          }
          
          const isUsd = ['USD', 'USDT', 'USDC'].includes(asset.currency?.toUpperCase());
          const valueInVnd = quantity * price * (isUsd ? usdtRate : 1);
          const costInVnd = cost * (isUsd ? usdtRate : 1);
          
          if (!accountData[asset.accountId]) {
            accountData[asset.accountId] = { value: 0, cost: 0, realizedProfit: 0 };
          }
          accountData[asset.accountId].value += valueInVnd;
          accountData[asset.accountId].cost += costInVnd;
        });

        // Add realized profit to accountData
        Object.entries(realizedProfitByAccount).forEach(([accountId, profit]) => {
          if (accountData[accountId]) {
            accountData[accountId].realizedProfit = profit;
          }
        });

        // Get VN-Index for this date
        const vnIndexObj = vnIndexHistory?.find(p => p.timestamp.startsWith(dateStr));
        if (vnIndexObj && vnIndexObj.value > 0) {
          lastVnIndex = vnIndexObj.value;
        }
        const vnIndex = lastVnIndex;

        // Create snapshots for this date
        Object.entries(accountData).forEach(([accountId, data]) => {
          const newRef = doc(collection(db, "assetHistory"));
          currentBatch.set(newRef, {
            userId: user.uid,
            accountId,
            date: dateStr,
            totalValue: data.value,
            totalCost: data.cost,
            realizedProfit: data.realizedProfit || 0,
            profit: data.value - data.cost,
            vnIndex,
            timestamp: new Date().toISOString()
          });
          batchCount++;
          
          if (batchCount >= 400) {
            // Commit batch if it reaches limit
          }
        });

        if (batchCount >= 400) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          batchCount = 0;
        }

        currentDate.setDate(currentDate.getDate() + 1);
        processedDays++;
        setBackfillProgress(Math.round((processedDays / totalDays) * 100));
      }

      if (batchCount > 0) {
        await currentBatch.commit();
      }
      
      console.log("Backfill complete");
    } catch (error) {
      console.error("Failed to backfill history", error);
    } finally {
      setIsBackfilling(false);
      setBackfillProgress(0);
    }
  };

  // Automatically snapshot when assets change (debounced) or on load
  useEffect(() => {
    if (assets.length > 0 && vnIndexValue !== null) {
      const timer = setTimeout(() => {
        snapshotPortfolio();
      }, 5000); // Wait 5s after assets load/change to snapshot
      return () => clearTimeout(timer);
    }
  }, [assets, vnIndexValue, usdtRate]);

  return { history, loading, isBackfilling, backfillProgress, snapshotPortfolio, backfillHistory };
};
