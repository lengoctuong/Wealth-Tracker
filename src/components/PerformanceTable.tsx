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
  for (let i = 5; i >= 0; i--) {
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

  // 1. Pre-group transactions by assetId for O(1) lookup
  const txsByAsset = useMemo(() => {
    const map: Record<string, InvestmentTransaction[]> = {};
    investmentTransactions.forEach(tx => {
      if (!map[tx.assetId]) map[tx.assetId] = [];
      map[tx.assetId].push(tx);
    });
    return map;
  }, [investmentTransactions]);

  const investmentAccounts = useMemo(() => {
    const filtered = accounts.filter(a => ['brokerage', 'crypto', 'fintech'].includes(a.type));
    return [...filtered].sort((a, b) => {
      const isASSI = a.name.toUpperCase().includes('SSI');
      const isBSSI = b.name.toUpperCase().includes('SSI');
      
      if (isASSI && !isBSSI) return 1;
      if (!isASSI && isBSSI) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [accounts]);

  useEffect(() => {
    let active = true;
    const fetchPrices = async () => {
      setLoading(true);
      const results: Record<string, PriceResult[]> = {};
      const symbols = Array.from(new Set(assets.filter(a => a.symbol).map(a => a.symbol!)));
      symbols.push('VNINDEX');

      try {
        // Process in chunks to be efficient
        const chunkSize = 15;
        for (let i = 0; i < symbols.length; i += chunkSize) {
          if (!active) break;
          const chunk = symbols.slice(i, i + chunkSize);

          await Promise.all(chunk.map(async (symbol) => {
            const docSnap = await getDoc(doc(db, 'marketData', symbol));
            if (docSnap.exists() && active) {
              const history = docSnap.data().history || [];

              // CRITICAL: Only store the 12 prices we actually need for the 6 periods
              const filteredHistory: PriceResult[] = [];
              periods.forEach(p => {
                // Latest price < start date
                const startP = history.slice().reverse().find((h: any) => h.timestamp < p.startStr);
                if (startP) filteredHistory.push({ timestamp: startP.timestamp + "T00:00:00", value: startP.value });

                // Latest price <= end date
                const endP = history.slice().reverse().find((h: any) => h.timestamp <= p.endStr);
                if (endP) filteredHistory.push({ timestamp: endP.timestamp + "T00:00:00", value: endP.value });
              });

              if (symbol === 'VNINDEX') {
                results['VNINDEX'] = filteredHistory;
              } else {
                assets.filter(a => a.symbol === symbol).forEach(a => {
                  results[a.id] = filteredHistory;
                });
              }
            }
          }));
        }

        if (active) setPrices(results);
      } catch (err) {
        console.error("Failed to fetch market data", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPrices();
    return () => { active = false; };
  }, [periods, assets.length]);

  const calculateCompounded = (perfs: (number | null)[]) => {
    if (perfs.every(p => p === null)) return null;
    return perfs.reduce((acc, p) => acc * (1 + (p || 0)), 1) - 1;
  };

  // 2. Pre-calculate everything
  const { periodStats, groupsWithActivity } = useMemo(() => {
    if (Object.keys(prices).length === 0) return { periodStats: [], groupsWithActivity: [] };

    const getPrice = (assetId: string, targetStr: string, isStart: boolean) => {
      const history = prices[assetId] || [];
      for (let i = history.length - 1; i >= 0; i--) {
        const hDate = history[i].timestamp.split('T')[0];
        if (isStart ? hDate < targetStr : hDate <= targetStr) return history[i].value;
      }
      return 0;
    };

    const accountsData = investmentAccounts.map(acc => ({
      account: acc,
      assets: assets.filter(a => a.accountId === acc.id && a.symbol)
    })).filter(g => g.assets.length > 0);

    accountsData.sort((a, b) => {
      const order = { fintech: 1, brokerage: 2, crypto: 3 };
      return (order[a.account.type as keyof typeof order] || 4) - (order[b.account.type as keyof typeof order] || 4);
    });

    const calculatedPeriods = periods.map(p => {
      let totalAllStart = 0, totalAllEnd = 0;
      const groupResults = accountsData.map(group => {
        let accStartVal = 0, accEndVal = 0;
        const mappedAssets = group.assets.map(asset => {
          const rate = ['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase() || '') ? usdtRate : 1;
          const startPrice = getPrice(asset.id, p.startStr, true) * rate;
          const endPrice = getPrice(asset.id, p.endStr, false) * rate;
          const txs = txsByAsset[asset.id] || [];

          let startQty = 0, buyVal = 0, sellVal = 0, endQty = 0;
          if (txs.length === 0) {
            startQty = endQty = asset.quantity || 0;
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
          const totalStart = (startQty * startPrice) + buyVal;
          const totalEnd = (endQty * endPrice) + sellVal;
          accStartVal += totalStart; accEndVal += totalEnd;
          return { asset, totalStart, totalEnd, perf: totalStart > 0 ? (totalEnd / totalStart) - 1 : null };
        });
        totalAllStart += accStartVal; totalAllEnd += accEndVal;
        return { account: group.account, assets: mappedAssets, perf: accStartVal > 0 ? (accEndVal / accStartVal) - 1 : null };
      });
      const vnStart = getPrice('VNINDEX', p.startStr, true);
      const vnEnd = getPrice('VNINDEX', p.endStr, false);
      return {
        vnPerf: vnStart > 0 ? (vnEnd / vnStart) - 1 : null,
        groups: groupResults.reduce((acc, g) => ({ ...acc, [g.account.id]: g }), {} as Record<string, any>),
        totalPerf: totalAllStart > 0 ? (totalAllEnd / totalAllStart) - 1 : null
      };
    });

    const activeGroups = accountsData.map((group) => {
      const activeAssets = group.assets.filter(asset => {
        return periods.some((_, pIdx) => {
          const groupStats = (calculatedPeriods[pIdx].groups as any)[group.account.id];
          const assetData = groupStats?.assets.find((a: any) => a.asset.id === asset.id);
          return assetData && (Math.abs(assetData.totalStart) > 1 || Math.abs(assetData.totalEnd) > 1);
        });
      });

      // Sort active assets by total (compounded) performance
      activeAssets.sort((a, b) => {
        const perfsA = periods.map((_, pIdx) => {
          const groupStats = (calculatedPeriods[pIdx].groups as any)[group.account.id];
          return groupStats?.assets.find((item: any) => item.asset.id === a.id)?.perf ?? null;
        });
        const perfsB = periods.map((_, pIdx) => {
          const groupStats = (calculatedPeriods[pIdx].groups as any)[group.account.id];
          return groupStats?.assets.find((item: any) => item.asset.id === b.id)?.perf ?? null;
        });
        const totalA = calculateCompounded(perfsA) ?? -Infinity;
        const totalB = calculateCompounded(perfsB) ?? -Infinity;
        return totalB - totalA;
      });

      return { ...group, assets: activeAssets };
    }).filter(g => g.assets.length > 0);

    return { periodStats: calculatedPeriods, groupsWithActivity: activeGroups };
  }, [prices, assets, periods, investmentAccounts, usdtRate, txsByAsset]);


  const renderPerfCell = (perf: number | null, isBold = false) => {
    if (perf === null) return <TableCell className="text-right text-gray-400">-</TableCell>;
    const isPos = perf >= 0;
    return (
      <TableCell className={`text-right ${isBold ? 'font-bold' : 'font-medium'} ${isPos ? 'text-green-600' : 'text-red-500'}`}>
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
            className={`px-3 py-1 text-[12px] font-medium rounded-md transition-all ${timeframe === 'week' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Theo Tuần
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`px-3 py-1 text-[12px] font-medium rounded-md transition-all ${timeframe === 'month' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
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
                  <TableHead className="text-right whitespace-nowrap font-bold text-blue-600 bg-blue-50/50">Tổng cộng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                  <TableCell className="font-bold text-orange-600">VN-Index</TableCell>
                  {periodStats.map((stat) => renderPerfCell(stat.vnPerf))}
                  {renderPerfCell(calculateCompounded(periodStats.map(s => s.vnPerf)), true)}
                </TableRow>

                {groupsWithActivity.map((group) => (
                  <React.Fragment key={group.account.id}>
                    {group.assets.filter(a => a.symbol).map((asset) => (
                      <TableRow key={`asset-${asset.id}`}>
                        <TableCell className="pl-4 py-2 font-medium flex items-center gap-2">
                          {asset.symbol}
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded">{group.account.name}</span>
                        </TableCell>
                        {periods.map((_, pIdx) => {
                          const groupStats = (periodStats[pIdx]?.groups as any)[group.account.id];
                          const perf = groupStats?.assets.find((a: any) => a.asset.id === asset.id)?.perf ?? null;
                          return renderPerfCell(perf);
                        })}
                        {renderPerfCell(calculateCompounded(periods.map((_, pIdx) => {
                          const groupStats = (periodStats[pIdx]?.groups as any)[group.account.id];
                          return groupStats?.assets.find((a: any) => a.asset.id === asset.id)?.perf ?? null;
                        })), true)}
                      </TableRow>
                    ))}
                    <TableRow className="bg-blue-50/50">
                      <TableCell className="pl-4 font-bold text-blue-800 text-xs py-2 uppercase">
                        Tổng hợp {group.account.name}
                      </TableCell>
                      {periods.map((_, pIdx) => {
                        const groupStats = (periodStats[pIdx]?.groups as any)[group.account.id];
                        return renderPerfCell(groupStats?.perf ?? null);
                      })}
                      {renderPerfCell(calculateCompounded(periods.map((_, pIdx) => {
                        const groupStats = (periodStats[pIdx]?.groups as any)[group.account.id];
                        return groupStats?.perf ?? null;
                      })), true)}
                    </TableRow>
                  </React.Fragment>
                ))}

                <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                  <TableCell className="font-bold text-slate-800 uppercase">TỔNG HIỆU SUẤT TOÀN BỘ TK</TableCell>
                  {periodStats.map((stat) => renderPerfCell(stat.totalPerf))}
                  {renderPerfCell(calculateCompounded(periodStats.map(s => s.totalPerf)), true)}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
