import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Account } from "../../hooks/useAccounts";
import { Asset } from "../../hooks/useAssets";
import { AssetHistory } from "../../hooks/useAssetHistory";
import { MarketData, MarketHistory } from "../../hooks/useMarketData";
import { InvestmentTransaction } from "../../hooks/useTransactions";
import { format, subDays, subMonths, subYears, isSameDay } from "date-fns";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { formatCurrency, getAssetValue, getStartDateForRange, findStartIndexForDate } from "../../lib/utils";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { PerformanceTable } from "../PerformanceTable";
import { ConfirmModal } from "../ConfirmModal";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658', '#d0ed57', '#a4de6c'];

interface Props {
  accounts: Account[];
  assets: Asset[];
  history: AssetHistory[];
  vnIndexHistory: MarketHistory[];
  vnIndex: MarketData | null;
  investmentTransactions?: InvestmentTransaction[];
  isBackfilling?: boolean;
  isSyncingMarketData?: boolean;
  syncProgress?: number;
  syncStatus?: string;
  backfillProgress?: number;
  backfillStatus?: string;
  onBackfill?: (txs: InvestmentTransaction[]) => void;
  usdtRate?: number;
  showValues?: boolean;
}

export function OverviewTab({
  accounts,
  assets,
  history,
  vnIndexHistory,
  vnIndex,
  investmentTransactions = [],
  isBackfilling = false,
  isSyncingMarketData = false,
  syncProgress = 0,
  syncStatus = "",
  backfillProgress = 0,
  backfillStatus = "",
  onBackfill,
  usdtRate = 25500,
  showValues = true
}: Props) {
  const [performanceTimeRange, setPerformanceTimeRange] = React.useState('30d');
  const [isTwrrOpen, setIsTwrrOpen] = React.useState(false);
  const [isDebugOpen, setIsDebugOpen] = React.useState(false);
  const [isConfirmSyncOpen, setIsConfirmSyncOpen] = React.useState(false);
  const filteredAssets = useMemo(() => {
    return assets.filter(a => !a.isFinished && (a.quantity === undefined || a.quantity > 0 || !["stock", "etf", "coin", "crypto", "fund", "position"].includes(a.category)));
  }, [assets]);

  // Helper to downsample data for Recharts to prevent RAM spikes on hover
  const downsampleData = <T extends any>(data: T[], maxPoints = 300): T[] => {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, i) => i === 0 || i === data.length - 1 || i % step === 0);
  };

  // Asset Allocation by Category with Details
  const categoryAllocation = useMemo(() => {
    const data: Record<string, { total: number, items: (Asset & { value: number })[] }> = {};

    filteredAssets.forEach(asset => {
      if (!asset) return;

      const valueInVnd = getAssetValue(asset, usdtRate);

      let categoryName = "Khác";
      if (asset.category && typeof asset.category === 'string') {
        if (['cash', 'payment', 'deposit'].includes(asset.category)) {
          categoryName = "Tiền mặt (Cash)";
        } else if (asset.category === 'saving') {
          categoryName = "Tiết kiệm (Saving)";
        } else if (asset.category === 'usdt' || asset.category === 'usdc') {
          categoryName = "USDT";
        } else if (asset.category.length > 0) {
          categoryName = asset.category.charAt(0).toUpperCase() + asset.category.slice(1);
        }
      }

      if (!data[categoryName]) {
        data[categoryName] = { total: 0, items: [] };
      }
      data[categoryName].total += valueInVnd;
      data[categoryName].items.push({ ...asset, value: valueInVnd });
    });

    return Object.entries(data)
      .map(([name, info]) => ({
        name,
        value: info.total,
        items: info.items.sort((a, b) => b.value - a.value)
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [assets, usdtRate]);

  // Calculate Current Net Worth from category allocation to ensure consistency
  const currentNetWorth = useMemo(() => {
    return categoryAllocation.reduce((acc, cat) => acc + cat.value, 0);
  }, [categoryAllocation]);

  // Move cash flow calculation up to be used by both chart and netWorthChanges
  const investmentCashFlowByDate = useMemo(() => {
    const investmentAccountIds = accounts
      .filter(a => ['brokerage', 'crypto', 'fintech', 'polymarket'].includes(a.type))
      .map(a => a.id);

    const tradingDates = new Set(vnIndexHistory.map(item => item.date));

    const cashFlowByDate: Record<string, number> = {};
    investmentTransactions.forEach(tx => {
      const asset = assets.find(a => a.id === tx.assetId);
      if (!asset || !investmentAccountIds.includes(asset.accountId)) return;

      let targetDate = tx.date;
      if (!tradingDates.has(targetDate)) {
        const sortedDates = Array.from(tradingDates).sort();
        const nextDate = sortedDates.find(d => d > targetDate);
        if (nextDate) targetDate = nextDate;
      }

      const rate = ['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase()) ? (usdtRate || 1) : 1;
      const amount = tx.quantity * tx.price * rate;

      if (!cashFlowByDate[targetDate]) cashFlowByDate[targetDate] = 0;

      if (tx.type === 'buy') {
        cashFlowByDate[targetDate] += amount;
      } else if (tx.type === 'sell') {
        cashFlowByDate[targetDate] -= amount;
      }
    });

    return cashFlowByDate;
  }, [investmentTransactions, assets, accounts, vnIndexHistory, usdtRate]);

  // Calculate Net Worth Changes with Cash Flow adjustment
  const netWorthChanges = useMemo(() => {
    const getNetWorthAndCF = (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // Find the latest history entry on or before this date
      const entriesBeforeOrOn = history
        .filter(h => h.date <= dateStr)
        .sort((a, b) => b.date.localeCompare(a.date));

      const oldValue = entriesBeforeOrOn.length > 0 
        ? history.filter(h => h.date === entriesBeforeOrOn[0].date).reduce((sum, h) => sum + h.totalValue, 0)
        : 0;

      // Sum all cash flows between (dateStr) and today
      const cashFlowInPeriod = Object.entries(investmentCashFlowByDate)
        .filter(([d]) => d > (entriesBeforeOrOn[0]?.date || dateStr) && d <= todayStr)
        .reduce((sum, [_, val]) => sum + val, 0);

      return { oldValue, cashFlowInPeriod };
    };

    const calculateChange = (periodDate: Date) => {
      const { oldValue, cashFlowInPeriod } = getNetWorthAndCF(periodDate);
      if (oldValue === 0) return { amount: 0, percent: 0 };
      
      // Profit in period = (Current - CashFlowInPeriod) - OldValue
      const amount = (currentNetWorth - cashFlowInPeriod) - oldValue;
      const percent = (amount / oldValue) * 100;
      return { amount, percent };
    };

    return {
      m1: calculateChange(subMonths(new Date(), 1)),
      m6: calculateChange(subMonths(new Date(), 6)),
      y1: calculateChange(subYears(new Date(), 1)),
      y3: calculateChange(subYears(new Date(), 3))
    };
  }, [currentNetWorth, history, investmentCashFlowByDate]);

  // Combined Investment Chart (Brokerage + Crypto + Fintech)
  const chartData = useMemo(() => {
    const investmentAccountIds = accounts
      .filter(a => ['brokerage', 'crypto', 'fintech', 'polymarket'].includes(a.type))
      .map(a => a.id);

    const tradingDates = new Set(vnIndexHistory.map(item => item.date));
    const cashFlowByDate = investmentCashFlowByDate;

    const historyByDate: Record<string, any> = {};

    vnIndexHistory.forEach(item => {
      historyByDate[item.date] = { date: item.date, value: null, vnIndex: item.price };
    });

    history.forEach(h => {
      // Skip weekends
      const date = new Date(h.date);
      const day = date.getDay();
      if (day === 0 || day === 6) return;

      // Only show days that Python API returns (trading days)
      if (!tradingDates.has(h.date)) return;

      if (investmentAccountIds.includes(h.accountId)) {
        if (!historyByDate[h.date]) {
          historyByDate[h.date] = { date: h.date, value: null, vnIndex: h.vnIndex };
        }
        if (historyByDate[h.date].value === null) {
          historyByDate[h.date].value = 0;
        }
        historyByDate[h.date].value += h.totalValue;
      }
    });

    let lastVnIndex = 0;
    let lastValue = 0;
    let sortedData = Object.values(historyByDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(d => {
        if (d.vnIndex > 0) lastVnIndex = d.vnIndex;
        if (d.value !== null) {
          lastValue = d.value;
        } else {
          d.value = lastValue;
        }
        return { ...d, vnIndex: d.vnIndex > 0 ? d.vnIndex : lastVnIndex };
      });

    // If the first entries are still 0, try to fill backward from the first non-zero
    const firstNonZeroVnIndex = sortedData.find(d => d.vnIndex > 0)?.vnIndex || 0;
    if (firstNonZeroVnIndex > 0) {
      sortedData = sortedData.map(d => ({
        ...d,
        vnIndex: d.vnIndex > 0 ? d.vnIndex : firstNonZeroVnIndex
      }));
    }

    // Filter to only show data from the first day the user has investment value
    const firstDataIndex = sortedData.findIndex(d => d.value > 0);
    let displayData = firstDataIndex !== -1 ? sortedData.slice(firstDataIndex) : sortedData;

    // Filter by time range using calendar dates
    const now = new Date();
    let startDate: Date | null = null;

    if (performanceTimeRange !== 'all') {
      startDate = getStartDateForRange(performanceTimeRange, now);
      const startIndex = findStartIndexForDate(displayData, startDate);
      if (startIndex !== -1) {
        displayData = displayData.slice(startIndex);
      }
    }

    if (displayData.length > 0) {
      const baseVnIndex = displayData[0].vnIndex || 1;
      let cumulativeReturn = 1;

      displayData.forEach((d, i) => {
        if (i === 0) {
          d.valuePct = 0;
        } else {
          const prev = displayData[i - 1];
          const cashFlow = cashFlowByDate[d.date] || 0;

          // TWRR formula: r = (V_current - CF - V_prev) / V_prev
          // This assumes cash flow happens at the end of the period
          if (prev.value > 0) {
            const periodReturn = (d.value - cashFlow - prev.value) / prev.value;
            cumulativeReturn *= (1 + periodReturn);
            d.twrrDetails = {
              vPrev: prev.value,
              vCurr: d.value,
              cashFlow: cashFlow,
              periodReturn: periodReturn,
              cumulativeReturn: cumulativeReturn
            };
          }
          d.valuePct = (cumulativeReturn - 1) * 100;
        }
        d.vnIndexPct = baseVnIndex > 0 ? ((d.vnIndex - baseVnIndex) / baseVnIndex) * 100 : 0;
      });
    }

    return downsampleData(displayData);
  }, [history, vnIndexHistory, accounts, investmentTransactions, assets, usdtRate, performanceTimeRange]);

  // Total Net Worth History Chart
  const netWorthHistoryData = useMemo(() => {
    const historyByDate: Record<string, { value: number | null, cost: number, profit: number }> = {};

    const tradingDates = new Set(vnIndexHistory.map(item => item.date));

    const cashFlowByDate: Record<string, number> = {};
    investmentTransactions.forEach(tx => {
      const asset = assets.find(a => a.id === tx.assetId);
      if (!asset) return;

      let targetDate = tx.date;
      if (!tradingDates.has(targetDate)) {
        const sortedDates = Array.from(tradingDates).sort();
        const nextDate = sortedDates.find(d => d > targetDate);
        if (nextDate) targetDate = nextDate;
      }

      const rate = ['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase()) ? (usdtRate || 1) : 1;
      const amount = tx.quantity * tx.price * rate;

      if (!cashFlowByDate[targetDate]) cashFlowByDate[targetDate] = 0;

      if (tx.type === 'buy') {
        cashFlowByDate[targetDate] += amount;
      } else if (tx.type === 'sell') {
        cashFlowByDate[targetDate] -= amount;
      }
    });

    vnIndexHistory.forEach(item => {
      historyByDate[item.date] = { value: null, cost: 0, profit: 0 };
    });

    history.forEach(h => {
      // Skip weekends
      const date = new Date(h.date);
      const day = date.getDay();
      if (day === 0 || day === 6) return;

      // Only show days that Python API returns (trading days)
      if (!tradingDates.has(h.date)) return;

      if (!historyByDate[h.date]) {
        historyByDate[h.date] = { value: null, cost: 0, profit: 0 };
      }
      if (historyByDate[h.date].value === null) {
        historyByDate[h.date].value = 0;
      }
      historyByDate[h.date].value! += h.totalValue;
      historyByDate[h.date].cost += h.totalCost || 0;
      historyByDate[h.date].profit += h.profit || 0;
    });

    const sortedEntries = Object.entries(historyByDate)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

    let cumulativeReturn = 1;
    let cumulativeCashFlow = 0;

    const resultData = sortedEntries.map(([date, data], i) => {
      const cashFlow = cashFlowByDate[date] || 0;
      cumulativeCashFlow += cashFlow;

      if (i > 0) {
        const prev = sortedEntries[i - 1][1];

        // TWRR period return: r = (V_current - CF - V_prev) / V_prev
        if (prev.value! > 0) {
          const periodReturn = (data.value! - cashFlow - prev.value!) / prev.value!;
          cumulativeReturn *= (1 + periodReturn);
        }
      } else if (i === 0 && cumulativeCashFlow === 0 && data.value! > 0) {
        // If no transactions but we have initial value, treat initial value as initial cash flow
        cumulativeCashFlow = data.value!;
      }

      return {
        date,
        value: data.value! || 0,
        // Net Invested Capital (Vốn đầu tư ròng)
        cost: cumulativeCashFlow,
        // Total Profit = Current Value - Net Invested Capital
        profit: (data.value! || 0) - cumulativeCashFlow,
        profitPct: (cumulativeReturn - 1) * 100
      };
    });

    // Filter to only show data from the first day the user has investment value
    const firstDataIndex = resultData.findIndex(d => d.value > 0);
    const displayData = firstDataIndex !== -1 ? resultData.slice(firstDataIndex) : resultData;
    
    return downsampleData(displayData);
  }, [history, vnIndexHistory, investmentTransactions, assets, usdtRate]);

  // Calculate Current Total Profit Breakdown
  const profitBreakdown = useMemo(() => {
    if (netWorthHistoryData.length === 0) return { total: 0, unrealized: 0, realized: 0, unrealizedPercent: 0, percent: 0 };
    
    const latest = netWorthHistoryData[netWorthHistoryData.length - 1];
    const totalProfit = latest.profit;

    // Unrealized = Sum((CurrentPrice - PurchasePrice) * Quantity) for active assets
    let currentHoldingsCost = 0;
    const unrealizedProfit = assets.reduce((sum, asset) => {
      const isInvest = ["stock", "etf", "coin", "crypto", "fund", "position"].includes(asset.category);
      if (!isInvest || !asset.quantity || asset.quantity <= 0 || !asset.purchasePrice || !asset.currentPrice) return sum;
      
      const rate = ['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase()) ? (usdtRate || 1) : 1;
      const cost = asset.purchasePrice * asset.quantity * rate;
      const profit = (asset.currentPrice - asset.purchasePrice) * asset.quantity * rate;
      
      currentHoldingsCost += cost;
      return sum + profit;
    }, 0);

    const unrealizedPercent = currentHoldingsCost > 0 ? (unrealizedProfit / currentHoldingsCost) * 100 : 0;

    return {
      total: totalProfit,
      unrealized: unrealizedProfit,
      unrealizedPercent: unrealizedPercent,
      realized: totalProfit - unrealizedProfit,
      percent: latest.profitPct
    };
  }, [netWorthHistoryData, assets, usdtRate]);

  // Top Assets
  const topAssets = useMemo(() => {
    return filteredAssets
      .map(asset => {
        const valueInVnd = getAssetValue(asset, usdtRate);
        const account = accounts.find(a => a.id === asset.accountId);
        return { ...asset, value: valueInVnd, platform: account?.name || "Khác" };
      })
      .filter(a => a.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [assets, usdtRate, accounts]);

  // Asset Allocation by Platform
  const platformAllocation = useMemo(() => {
    const data: Record<string, number> = {};
    filteredAssets.forEach(asset => {
      const valueInVnd = getAssetValue(asset, usdtRate);

      const account = accounts.find(a => a.id === asset.accountId);
      const platformName = account?.name || "Khác";

      data[platformName] = (data[platformName] || 0) + valueInVnd;
    });

    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [assets, accounts, usdtRate]);

  const renderChange = (change: { amount: number, percent: number }, label: string) => {
    const isPositive = change.amount > 0;
    const isNegative = change.amount < 0;

    return (
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">{label}</span>
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? <TrendingUp className="w-4 h-4 text-green-500" /> :
            isNegative ? <TrendingDown className="w-4 h-4 text-red-500" /> :
              <Minus className="w-4 h-4 text-gray-400" />}
          <span className={`text-sm font-bold ${isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-600"}`}>
            {isPositive ? "+" : ""}{change.percent.toFixed(2)}%
          </span>
        </div>
        <span className="text-xs text-gray-400 mt-0.5">{showValues ? formatCurrency(change.amount) : "****"}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Section: Net Worth and Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-2 border-none shadow-md bg-gradient-to-br from-primary to-blue-600 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <CardHeader>
            <CardTitle className="text-lg font-medium opacity-90">Tổng Tài Sản Ròng</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight mb-6">
              {showValues ? formatCurrency(currentNetWorth) : "****"}
            </div>
            <div className="grid grid-cols-2 gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
              {renderChange(netWorthChanges.m1, "30 ngày")}
              {renderChange(netWorthChanges.m6, "6 tháng")}
              {renderChange(netWorthChanges.y1, "1 năm")}
              {renderChange(netWorthChanges.y3, "3 năm")}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-gray-800">Tổng Lãi/Lỗ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold tracking-tight ${profitBreakdown.total >= 0 ? "text-green-600" : "text-red-600"}`}>
              {showValues ? (profitBreakdown.total >= 0 ? "+" : "") + formatCurrency(profitBreakdown.total) : "****"}
            </div>
            <div className={`flex items-center gap-1 text-sm font-bold mt-1 ${profitBreakdown.total >= 0 ? "text-green-600" : "text-red-600"}`}>
              {profitBreakdown.total >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {profitBreakdown.total >= 0 ? "+" : ""}{profitBreakdown.percent.toFixed(2)}% (TWRR)
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Lãi tạm tính (Unrealized):</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1 rounded ${profitBreakdown.unrealized >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {profitBreakdown.unrealized >= 0 ? "+" : ""}{profitBreakdown.unrealizedPercent.toFixed(2)}%
                  </span>
                  <span className={`font-bold ${profitBreakdown.unrealized >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {showValues ? (profitBreakdown.unrealized >= 0 ? "+" : "") + formatCurrency(profitBreakdown.unrealized) : "****"}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Lãi đã chốt (Realized):</span>
                <span className={`font-bold ${profitBreakdown.realized >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {showValues ? (profitBreakdown.realized >= 0 ? "+" : "") + formatCurrency(profitBreakdown.realized) : "****"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-gray-800">Tỷ lệ Tiền mặt</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center h-full pb-8">
            {(() => {
              const liquidValue = filteredAssets
                .filter(a => ['cash', 'payment', 'deposit', 'saving', 'usdt', 'usdc'].includes(a.category))
                .reduce((sum, a) => sum + getAssetValue(a, usdtRate), 0);
              const liquidPercent = currentNetWorth > 0 ? (liquidValue / currentNetWorth) * 100 : 0;

              return (
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">{liquidPercent.toFixed(1)}%</div>
                  <p className="text-sm text-gray-500">{showValues ? formatCurrency(liquidValue) : "****"}</p>
                  <div className="w-full bg-gray-100 h-2 rounded-full mt-4 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-500"
                      style={{ width: `${liquidPercent}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Performance Comparison Table */}
      <PerformanceTable
        accounts={accounts}
        assets={assets}
        investmentTransactions={investmentTransactions}
        usdtRate={usdtRate}
      />

      {/* Row 2: Performance Chart (Full width) */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg font-medium">Hiệu suất Đầu tư vs VN-Index (%)</CardTitle>
              <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                {['7d', '30d', '3m', '6m', '1y', '3y', '5y', 'all'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setPerformanceTimeRange(range)}
                    className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${performanceTimeRange === range
                      ? "bg-white text-primary shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    {range === '7d' ? '1W' :
                      range === '30d' ? '1M' :
                        range === '3m' ? '3M' :
                          range === '6m' ? '6M' :
                            range === '1y' ? '1Y' :
                              range === '3y' ? '3Y' :
                                range === '5y' ? '5Y' : 'Tất cả'}
                  </button>
                ))}
              </div>
            </div>
            {(onBackfill || isBackfilling || isSyncingMarketData) && (
              <div className="flex items-center gap-4">
                {(isBackfilling || isSyncingMarketData) && (
                  <div className="flex flex-col items-end gap-1 text-right">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-tight">
                      {isSyncingMarketData ? (
                        <>
                          <span className="bg-blue-100 px-1.5 py-0.5 rounded">Bước 1/2</span>
                          <span>{syncStatus || "Đang cập nhật giá thị trường..."}</span>
                          <span className="text-blue-400">({syncProgress}%)</span>
                        </>
                      ) : (
                        <>
                          <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Bước 2/2</span>
                          <span>{backfillStatus || "Đang đồng bộ lịch sử..."}</span>
                          <span className="text-green-400">({backfillProgress}%)</span>
                        </>
                      )}
                    </div>
                    <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <div 
                        className={`h-full transition-all duration-300 ${isSyncingMarketData ? 'bg-blue-500' : 'bg-green-500'}`}
                        style={{ width: `${isSyncingMarketData ? syncProgress : backfillProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col items-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsConfirmSyncOpen(true)}
                    disabled={isBackfilling || isSyncingMarketData}
                    className="h-8 text-[10px] font-bold uppercase tracking-wider relative overflow-hidden group"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1.5 ${isBackfilling || isSyncingMarketData ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    {isSyncingMarketData ? 'Đang lưu giá...' : isBackfilling ? 'Đang đồng bộ...' : 'Đồng bộ lịch sử'}
                  </Button>
                  {!isBackfilling && !isSyncingMarketData && (
                    <p className="text-[9px] text-gray-400 max-w-[200px] text-right">
                      Cập nhật giá và tính toán lại toàn bộ lịch sử tài sản.
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="h-[350px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => format(new Date(val), 'dd/MM')}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(val) => `${val.toFixed(1)}%`}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs">
                            <p className="font-bold mb-2">{format(new Date(label), 'dd/MM/yyyy')}</p>
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex flex-col mb-2 last:mb-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="font-medium text-gray-600">
                                    {entry.name === 'valuePct' ? 'Tài sản đầu tư' : 'VN-Index'}:
                                  </span>
                                  <span className={`font-bold ${entry.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {entry.value >= 0 ? '+' : ''}{entry.value.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="pl-4 text-gray-400">
                                  Giá trị: {entry.name === 'valuePct'
                                    ? (showValues ? formatCurrency(entry.payload.value) : "****")
                                    : entry.payload.vnIndex.toLocaleString()}
                                </div>
                                {entry.name === 'valuePct' && entry.payload.twrrDetails && (
                                  <div className="pl-4 mt-1 text-[10px] text-slate-400 border-l border-slate-200 ml-1">
                                    <div>V_prev: {showValues ? formatCurrency(entry.payload.twrrDetails.vPrev) : "****"}</div>
                                    <div>CashFlow: {showValues ? formatCurrency(entry.payload.twrrDetails.cashFlow) : "****"}</div>
                                    <div>V_curr: {showValues ? formatCurrency(entry.payload.twrrDetails.vCurr) : "****"}</div>
                                    <div className="font-bold text-slate-500">r = (V_curr - CF - V_prev) / V_prev = {(entry.payload.twrrDetails.periodReturn * 100).toFixed(2)}%</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend formatter={(value) => value === 'valuePct' ? 'Tài sản đầu tư' : 'VN-Index'} />
                  <Line type="monotone" dataKey="valuePct" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="vnIndexPct" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Chưa có dữ liệu lịch sử
              </div>
            )}
          </CardContent>
        </Card>

        {/* TWRR Debug Table - Merged with Chart Data */}
        {/* Net Worth History Chart */}
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Biến động Tài sản Đầu tư & Lãi/Lỗ</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            {netWorthHistoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={netWorthHistoryData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => format(new Date(val), 'dd/MM')}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs">
                            <p className="font-bold mb-2">{format(new Date(label), 'dd/MM/yyyy')}</p>
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="font-medium text-gray-600">
                                  {entry.name}:
                                </span>
                                <span className={`font-bold ${entry.name === 'Lãi/Lỗ' ? (entry.value >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-900'}`}>
                                  {showValues ? formatCurrency(entry.value) : "****"}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="value" name="Tổng giá trị" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line yAxisId="left" type="monotone" dataKey="cost" name="Vốn đầu tư ròng" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="profit" name="Tổng Lãi/Lỗ" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Chưa có dữ liệu lịch sử tài sản
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Category Breakdown (Left) and Top Assets (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Table */}
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Chi tiết theo loại tài sản</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryAllocation.map((item, index) => (
                <details key={item.name} className="group p-4 rounded-lg bg-gray-50 border border-gray-100 open:bg-white open:shadow-sm transition-all">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <div>
                        <span className="text-sm font-bold text-gray-700">{item.name}</span>
                        <div className="text-xs text-gray-500">
                          {((item.value / currentNetWorth) * 100).toFixed(1)}% tổng tài sản
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{showValues ? formatCurrency(item.value) : "****"}</div>
                      </div>
                      <div className="text-gray-400 group-open:rotate-180 transition-transform">
                        <TrendingDown className="w-4 h-4 rotate-180" />
                      </div>
                    </div>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {item.items.map(asset => (
                      <div key={asset.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 font-medium">{asset.symbol || asset.name}</span>
                          {asset.accountId && (
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                              {accounts.find(a => a.id === asset.accountId)?.name}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-800">{showValues ? formatCurrency(asset.value) : "****"}</div>
                          {asset.currency !== 'VND' && showValues && (
                            <div className="text-[10px] text-gray-400">
                              {formatCurrency(getAssetValue(asset, 1), asset.currency)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Assets Card */}
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Tài sản lớn nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topAssets.length > 0 ? topAssets.map((asset, index) => (
                <div key={asset.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{asset.symbol || asset.name}</div>
                      <div className="text-xs text-gray-500">{asset.category} • {(asset as any).platform}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{showValues ? formatCurrency(asset.value) : "****"}</div>
                    {asset.currency !== 'VND' && showValues && (
                      <div className="text-[10px] text-gray-500">
                        {formatCurrency(getAssetValue(asset, 1), asset.currency)}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      {((asset.value / currentNetWorth) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-400">Chưa có tài sản</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation Chart */}
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Phân bổ theo loại tài sản</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            {categoryAllocation.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryAllocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => showValues ? formatCurrency(value) : "****"} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Chưa có dữ liệu tài sản
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Allocation Chart */}
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Phân bổ theo nền tảng</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            {platformAllocation.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {platformAllocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => showValues ? formatCurrency(value) : "****"} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Chưa có dữ liệu nền tảng
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <details
        className="mt-4 group border-t border-slate-200 pt-4"
        onToggle={(e) => setIsTwrrOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-600 transition-colors list-none">
          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full group-open:bg-blue-500 group-open:animate-pulse"></div>
          CHI TIẾT HIỆU SUẤT ĐẦU TƯ (TWRR vs VN-Index)
          <span className="text-[10px] font-normal opacity-60 group-open:hidden">(Click để xem chi tiết)</span>
        </summary>

        {isTwrrOpen && (
          <div className="mt-4 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-200">
                  <TableHead className="text-[10px] uppercase text-slate-500">Ngày</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-500 text-right">V_trước (VND)</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-500 text-right">Dòng tiền (CF)</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-500 text-right">V_hiện_tại (VND)</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-500 text-right">r (%)</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-500 text-right font-bold">Tích lũy (%)</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-500 text-right">VN-Index</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-500 text-right font-bold">VN-Index (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.map((d, idx) => (
                  <TableRow key={`twrr-debug-${d.date}`} className="border-slate-100 hover:bg-slate-50 transition-colors">
                    <TableCell className="text-[11px] font-mono text-slate-600">{d.date}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-slate-500">
                      {idx === 0 ? '-' : (showValues ? d.twrrDetails?.vPrev.toLocaleString() : "****")}
                    </TableCell>
                    <TableCell className={`text-[11px] text-right font-mono ${d.twrrDetails?.cashFlow > 0 ? 'text-blue-600' : d.twrrDetails?.cashFlow < 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                      {idx === 0 ? '-' : (showValues ? (d.twrrDetails?.cashFlow > 0 ? '+' : '') + d.twrrDetails?.cashFlow.toLocaleString() : "****")}
                    </TableCell>
                    <TableCell className="text-[11px] text-right font-mono font-medium text-slate-700">
                      {showValues ? d.value.toLocaleString() : "****"}
                    </TableCell>
                    <TableCell className={`text-[11px] text-right font-mono font-bold ${d.twrrDetails?.periodReturn > 0 ? 'text-green-600' : d.twrrDetails?.periodReturn < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {idx === 0 ? '0.00%' : (d.twrrDetails?.periodReturn * 100).toFixed(2) + '%'}
                    </TableCell>
                    <TableCell className={`text-[11px] text-right font-mono font-black ${d.valuePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {d.valuePct >= 0 ? '+' : ''}{d.valuePct.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-slate-500">
                      {d.vnIndex.toLocaleString()}
                    </TableCell>
                    <TableCell className={`text-[11px] text-right font-mono font-bold ${d.vnIndexPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {d.vnIndexPct >= 0 ? '+' : ''}{d.vnIndexPct.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 p-4 bg-white rounded-xl border border-blue-100 text-xs text-slate-600 leading-relaxed">
              <p className="font-bold text-blue-700 mb-2">Công thức tính TWRR:</p>
              <ol className="list-decimal pl-4 space-y-2">
                <li><strong>Dòng tiền (Cash Flow - CF):</strong> <code className="bg-slate-100 px-1 rounded">CF = Tổng_Mua - Tổng_Bán</code> trong ngày.</li>
                <li><strong>Tỷ suất lợi nhuận kỳ (Period Return - r):</strong> <code className="bg-slate-100 px-1 rounded">r = (V_hiện_tại - CF - V_trước) / V_trước</code>.</li>
                <li><strong>Lợi nhuận tích lũy (Cumulative Return):</strong> <code className="bg-slate-100 px-1 rounded">R_tổng = (1 + r1) * (1 + r2) * ... * (1 + rn) - 1</code>.</li>
              </ol>
            </div>
          </div>
        )}
      </details>

      {/* Debug Calculation Section (Collapsible at bottom) */}
      <details
        className="mt-4 group border-t border-slate-200 pt-4"
        onToggle={(e) => setIsDebugOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-600 transition-colors list-none">
          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full group-open:bg-blue-500 group-open:animate-pulse"></div>
          CÔNG CỤ DEBUG: CHI TIẾT TÍNH TOÁN TỔNG TÀI SẢN
          <span className="text-[10px] font-normal opacity-60 group-open:hidden">(Click để xem chi tiết)</span>
        </summary>

        {isDebugOpen && (
          <div className="mt-4 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
            <div className="space-y-4">
              {categoryAllocation.map((cat, idx) => (
                <div key={cat.name} className="text-xs border-b border-slate-200 pb-3 last:border-0">
                  <div className="flex justify-between font-bold text-slate-700 mb-2 text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      {cat.name}
                    </span>
                    <span>{cat.value.toLocaleString()} VND</span>
                  </div>
                  <div className="pl-5 text-slate-500 space-y-1.5">
                    {cat.items.map(a => (
                      <div key={a.id} className="flex justify-between items-center hover:bg-slate-100 p-1 rounded transition-colors">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-600">• {a.name}</span>
                          <span className="text-[10px] opacity-70">
                            Tài khoản: {accounts.find(acc => acc.id === a.accountId)?.name || 'N/A'} |
                            ID: {a.id.slice(-6)} |
                            Loại gốc: {a.category || 'null'}
                          </span>
                        </div>
                        <span className="font-mono">{a.value.toLocaleString()} VND</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-4 flex justify-between font-black text-base text-blue-600 border-t-2 border-blue-200 mt-2 bg-blue-50/50 p-2 rounded">
                <span>TỔNG CỘNG (SUM OF ALL ABOVE)</span>
                <span>{currentNetWorth.toLocaleString()} VND</span>
              </div>
            </div>
          </div>
        )}
      </details>
      
      <ConfirmModal
        isOpen={isConfirmSyncOpen}
        onClose={() => setIsConfirmSyncOpen(false)}
        onConfirm={() => {
          setIsConfirmSyncOpen(false);
          onBackfill?.(investmentTransactions);
        }}
        title="Đồng bộ lịch sử tài sản"
        description="Quy trình này sẽ cập nhật giá thị trường mới nhất và tính toán lại toàn bộ lịch sử biến động từ giao dịch đầu tiên. Việc này có thể mất vài phút tùy vào số lượng giao dịch của bạn. Bạn có muốn tiếp tục?"
        confirmText="Đồng bộ"
        confirmVariant="default"
      />
    </div>
  );
}
