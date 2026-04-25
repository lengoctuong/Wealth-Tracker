import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Account } from '../hooks/useAccounts';
import { Asset } from '../hooks/useAssets';
import { InvestmentTransaction } from '../hooks/useTransactions';
import { marketService, PriceResult } from '../services/marketService';
import { subDays, subMonths, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, min } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { getAssetValue } from '../lib/utils';

interface Props {
  accounts: Account[];
  assets: Asset[];
  investmentTransactions: InvestmentTransaction[];
  usdtRate?: number;
}

interface Period {
  label: string;
  startStr: string;
  endStr: string;
}

const generatePeriods = (timeframe: 'week' | 'month'): Period[] => {
  const periods: Period[] = [];
  const today = new Date();
  for (let i = 3; i >= 0; i--) {
    if (timeframe === 'week') {
      const start = startOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const actualEnd = min([end, today]);
      periods.push({
        label: i === 0 ? 'Tuần này' : `${format(start, 'dd/MM')}-${format(end, 'dd/MM')}`,
        startStr: format(start, 'yyyy-MM-dd'),
        endStr: format(actualEnd, 'yyyy-MM-dd')
      });
    } else {
      const start = startOfMonth(subMonths(today, i));
      const end = endOfMonth(start);
      const actualEnd = min([end, today]);
      periods.push({
        label: i === 0 ? 'Tháng này' : format(start, 'MM/yyyy'),
        startStr: format(start, 'yyyy-MM-dd'),
        endStr: format(actualEnd, 'yyyy-MM-dd')
      });
    }
  }
  return periods;
};

import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export function PerformanceTable({ accounts, assets, investmentTransactions, usdtRate = 25500 }: Props) {
  const [timeframe, setTimeframe] = useState<'week' | 'month'>('week');
  const [prices, setPrices] = useState<Record<string, PriceResult[]>>({});
  const [loading, setLoading] = useState(false);

  const periods = useMemo(() => generatePeriods(timeframe), [timeframe]);

  const investmentAccounts = useMemo(() => accounts.filter(a => ['brokerage', 'crypto', 'fintech'].includes(a.type)), [accounts]);
  
  const validAssets = useMemo(() => {
    const accIds = investmentAccounts.map(a => a.id);
    return assets.filter(a => accIds.includes(a.accountId) && a.symbol && !a.isFinished);
  }, [assets, investmentAccounts]);

  useEffect(() => {
    let active = true;
    const fetchPricesFromDB = async () => {
      setLoading(true);
      const results: Record<string, PriceResult[]> = {};

      try {
        // Collect all distinct symbols
        const symbols = Array.from(new Set(validAssets.map(a => a.symbol)));
        symbols.push('VNINDEX');

        for (const symbol of symbols) {
          if (!symbol) continue;
          const docRef = doc(db, 'marketData', symbol);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.history) {
              // Convert to PriceResult array and map to object by asset.id and 'VNINDEX'
              // wait, the previous code mapped prices to asset.id, not symbol.
              // So we need to store for symbol, and then construct `results` keyed by asset.id.
              const historyArray = data.history.map((h: any) => ({
                timestamp: h.timestamp + "T00:00:00", // pad for compatibility with existing getPrice
                value: h.value
              }));
              
              if (symbol === 'VNINDEX') {
                results['VNINDEX'] = historyArray;
              } else {
                // Find all assets with this symbol and map them
                const matchedAssets = validAssets.filter(a => a.symbol === symbol);
                matchedAssets.forEach(a => {
                  results[a.id] = historyArray;
                });
              }
            }
          }
        }

        if (active) {
          setPrices(results);
        }
      } catch (err) {
        console.error("Failed to fetch market data from DB", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPricesFromDB();
    return () => { active = false; };
  }, [periods[0].startStr, validAssets.length]); // Re-fetch if oldest start changes

  const calculatePerformance = () => {
    // 1. Group assets by Account: Fintech (Fund), Brokerage (Stock), Crypto (Crypto)
    // Actually group by account.id for summary rows
    const accountsData = investmentAccounts.map(acc => {
      const accAssets = validAssets.filter(a => a.accountId === acc.id);
      return { account: acc, assets: accAssets };
    }).filter(group => group.assets.length > 0);

    // Sort groups: Fintech -> Brokerage -> Crypto
    accountsData.sort((a, b) => {
      const order = { fintech: 1, brokerage: 2, crypto: 3 };
      const oa = order[a.account.type as keyof typeof order] || 4;
      const ob = order[b.account.type as keyof typeof order] || 4;
      return oa - ob;
    });

    // We will build a matrix: for each period, calculated start/end values.
    // Helper to get price
    const getPrice = (assetId: string, targetStr: string, isStart: boolean) => {
      const history = prices[assetId] || [];
      if (history.length === 0) return 0;
      // if isStart, find largest date < targetStr
      // if not isStart, find largest date <= targetStr
      let found = null;
      for (let i = history.length - 1; i >= 0; i--) {
        if (isStart ? history[i].timestamp < targetStr : history[i].timestamp <= targetStr) {
          found = history[i].value;
          break;
        }
      }
      // fallback to first available if none found and it's not start
      if (found === null && history.length > 0 && !isStart) found = history[0].value;
      return found || 0;
    };

    const periodStats = periods.map(p => {
      const accStats: any[] = [];
      let totalAllStart = 0;
      let totalAllEnd = 0;

      // Group by Account
      const groupResults = accountsData.map(group => {
        let accStartVal = 0;
        let accEndVal = 0;
        const mappedAssets = group.assets.map(asset => {
          const rate = ['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase() || '') ? usdtRate : 1;
          
          const startPriceRaw = getPrice(asset.id, p.startStr, true);
          const endPriceRaw = getPrice(asset.id, p.endStr, false);
          
          const startPrice = startPriceRaw * rate;
          const endPrice = endPriceRaw * rate;

          // Transactions
          const txs = investmentTransactions.filter(tx => tx.assetId === asset.id);
          
          // Qty before start
          let startQty = 0;
          let buyVal = 0;
          let sellVal = 0;
          let endQty = 0;

          if (txs.length === 0) {
            // Fallback for assets tracked manually without transactions
            startQty = asset.quantity || 0;
            endQty = asset.quantity || 0;
          } else {
            txs.forEach(tx => {
              if (tx.date < p.startStr) {
                if (tx.type === 'buy') startQty += tx.quantity;
                else if (tx.type === 'sell') startQty -= tx.quantity;
              } else if (tx.date >= p.startStr && tx.date <= p.endStr) {
                if (tx.type === 'buy') buyVal += tx.quantity * tx.price * rate;
                else if (tx.type === 'sell') sellVal += tx.quantity * tx.price * rate;
              }
            });
            
            endQty = startQty;
            txs.forEach(tx => {
              if (tx.date >= p.startStr && tx.date <= p.endStr) {
                if (tx.type === 'buy') endQty += tx.quantity;
                else if (tx.type === 'sell') endQty -= tx.quantity;
              }
            });
          }

          // Formula:
          const baseStart = startQty * startPrice;
          const baseEnd = endQty * endPrice;
          
          const totalStart = baseStart + buyVal;
          const totalEnd = baseEnd + sellVal;
          
          accStartVal += totalStart;
          accEndVal += totalEnd;

          // Pure price perf if we want just price diff
          // But user wants: (End / Start) - 1 for individual assets? Wait.
          // "tổng hợp hiệu suất các mã ... tính dựa trên tổng giá trị đầu cuối kì"
          // "đối với mã phát sinh trong kì thì tính theo giá mua... "
          // This implies asset row itself also uses this logic.
          const assetPerf = totalStart > 0 ? (totalEnd / totalStart) - 1 : null;

          return {
            asset,
            totalStart,
            totalEnd,
            perf: assetPerf
          };
        });

        const accPerf = accStartVal > 0 ? (accEndVal / accStartVal) - 1 : null;
        totalAllStart += accStartVal;
        totalAllEnd += accEndVal;

        return {
          account: group.account,
          assets: mappedAssets,
          accStartVal,
          accEndVal,
          perf: accPerf
        };
      });

      // VNIndex
      const vnStart = getPrice('VNINDEX', p.startStr, true);
      const vnEnd = getPrice('VNINDEX', p.endStr, false);
      const vnPerf = vnStart > 0 ? (vnEnd / vnStart) - 1 : null;

      const totalPerf = totalAllStart > 0 ? (totalAllEnd / totalAllStart) - 1 : null;

      return {
        vnPerf,
        groups: groupResults,
        totalPerf
      };
    });

    return periodStats;
  };

  const periodStats = calculatePerformance();

  const renderPerfCell = (perf: number | null) => {
    if (perf === null) return <TableCell className="text-right text-gray-400">-</TableCell>;
    const isPos = perf >= 0;
    return (
      <TableCell className={`text-right font-medium ${isPos ? 'text-green-600' : 'text-red-500'}`}>
        {isPos ? '+' : ''}{(perf * 100).toFixed(2)}%
      </TableCell>
    );
  };

  return (
    <Card className="border-none shadow-md mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Bảng so sánh hiệu suất theo kỳ</CardTitle>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setTimeframe('week')}
            className={`px-3 py-1 text-[12px] font-medium rounded-md transition-all ${
              timeframe === 'week' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Theo Tuần
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`px-3 py-1 text-[12px] font-medium rounded-md transition-all ${
              timeframe === 'month' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Theo Tháng
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold">Mã / Tài khoản</TableHead>
                  {periods.map(p => (
                    <TableHead key={p.label} className="text-right whitespace-nowrap">{p.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* VNIndex Row */}
                <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                  <TableCell className="font-bold text-orange-600">VN-Index</TableCell>
                  {periodStats.map((stat, i) => renderPerfCell(stat.vnPerf))}
                </TableRow>

                {/* Groups */}
                {/* We need to restructure data: per column we have stats. We need to iterate over rows (groups -> assets) */}
                
                {(() => {
                  const groupsData = periodStats[0]?.groups || []; // use the structure from first period
                  const rows: React.ReactNode[] = [];
                  
                  groupsData.forEach((groupStructure, gIdx) => {
                    // Render assets for this group
                    groupStructure.assets.forEach((assetStruct) => {
                      rows.push(
                        <TableRow key={`asset-${assetStruct.asset.id}`}>
                          <TableCell className="pl-4 py-2 font-medium flex items-center gap-2">
                            {assetStruct.asset.symbol}
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded">{groupStructure.account.name}</span>
                          </TableCell>
                          {periods.map((_, pIdx) => {
                            const perf = periodStats[pIdx].groups[gIdx].assets.find(a => a.asset.id === assetStruct.asset.id)?.perf || null;
                            return renderPerfCell(perf);
                          })}
                        </TableRow>
                      );
                    });

                    // Render group summary summary
                    rows.push(
                      <TableRow key={`summary-${groupStructure.account.id}`} className="bg-blue-50/50">
                        <TableCell className="pl-4 font-bold text-blue-800 text-xs py-2 uppercase">
                          Tổng hợp {groupStructure.account.name}
                        </TableCell>
                        {periods.map((_, pIdx) => {
                          const perf = periodStats[pIdx].groups[gIdx].perf;
                          return renderPerfCell(perf);
                        })}
                      </TableRow>
                    );
                  });

                  return rows;
                })()}

                {/* Total Row */}
                <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                  <TableCell className="font-bold text-slate-800 uppercase">TỔNG HIỆU SUẤT TOÀN BỘ TK</TableCell>
                  {periodStats.map((stat, i) => renderPerfCell(stat.totalPerf))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
