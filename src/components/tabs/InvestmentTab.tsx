import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Trash2, TrendingUp, Coins, Landmark, Edit2, Target, Cpu, MoreHorizontal, ArrowRightLeft, RefreshCw } from "lucide-react";
import { Account, AccountType } from "../../hooks/useAccounts";
import { Asset } from "../../hooks/useAssets";
import { AssetHistory } from "../../hooks/useAssetHistory";
import { MarketHistory } from "../../hooks/useMarketData";
import { InvestmentTransaction } from "../../hooks/useTransactions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ConfirmModal } from "../ConfirmModal";
import { formatCurrency, getAssetValue, getPurchaseValue, getStartDateForRange, findStartIndexForDate, getCategoryLabel } from "../../lib/utils";

interface Props {
  type: AccountType;
  title: string;
  accounts: Account[];
  assets: Asset[];
  history: AssetHistory[];
  vnIndexHistory: MarketHistory[];
  investmentTransactions: InvestmentTransaction[];
  usdtRate?: number;
  showValues?: boolean;
  onDeleteAsset: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onEditAsset: (asset: Asset) => void;
  onEditAccount: (account: Account) => void;
  onOpenTransactions: (asset: Asset) => void;
}

export function InvestmentTab({
  type,
  title,
  accounts,
  assets,
  history,
  vnIndexHistory,
  investmentTransactions,
  usdtRate = 25500,
  showValues = true,
  onDeleteAsset,
  onDeleteAccount,
  onEditAsset,
  onEditAccount,
  onOpenTransactions
}: Props) {
  const [deleteAccountInfo, setDeleteAccountInfo] = useState<{ id: string, name: string } | null>(null);
  const [deleteAssetInfo, setDeleteAssetInfo] = useState<{ id: string, name: string } | null>(null);
  const [timeRanges, setTimeRanges] = useState<Record<string, string>>({});

  // Pre-group history by accountId to avoid repeated filtering in the render loop
  const historyByAccount = useMemo(() => {
    const groups: Record<string, any[]> = {};
    history.forEach(h => {
      if (!groups[h.accountId]) groups[h.accountId] = [];
      groups[h.accountId].push(h);
    });
    return groups;
  }, [history]);

  const filteredAccounts = accounts.filter(a => a.type === type || (type === 'crypto' && a.type === 'polymarket'));

  const getAssetIcon = (category: string) => {
    switch (category) {
      case 'stock': return <TrendingUp className="w-4 h-4" />;
      case 'coin': return <Coins className="w-4 h-4" />;
      case 'fund': return <Landmark className="w-4 h-4" />;
      case 'etf': return <TrendingUp className="w-4 h-4" />;
      case 'bot': return <Cpu className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  const getChartData = (accountId: string, timeRange: string) => {
    const historyByDate: Record<string, any> = {};

    // Process VNIndex history first to establish timeline
    vnIndexHistory.forEach(item => {
      historyByDate[item.date] = { date: item.date, value: null, vnIndex: item.price };
    });

    const tradingDates = new Set(vnIndexHistory.map(item => item.date));

    const cashFlowByDate: Record<string, number> = {};
    investmentTransactions.forEach(tx => {
      const asset = assets.find(a => a.id === tx.assetId);
      if (!asset || asset.accountId !== accountId) return;

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

    // Add asset history using pre-grouped data
    const accountHistory = historyByAccount[accountId] || [];
    accountHistory.forEach(h => {
      // Skip weekends
      const date = new Date(h.date);
      const day = date.getDay();
      if (day === 0 || day === 6) return;

      // Only show days that Python API returns (trading days)
      if (!tradingDates.has(h.date)) return;

      if (!historyByDate[h.date]) {
        historyByDate[h.date] = { date: h.date, value: null, vnIndex: h.vnIndex };
      }
      if (historyByDate[h.date].value === null) {
        historyByDate[h.date].value = 0;
      }
      historyByDate[h.date].value += h.totalValue;
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

    // Filter to only show data from the first day the account has value
    const firstDataIndex = sortedData.findIndex(d => d.value > 0);
    let displayData = firstDataIndex !== -1 ? sortedData.slice(firstDataIndex) : sortedData;

    // Filter by time range using calendar dates
    const now = new Date();
    let startDate: Date | null = null;

    if (timeRange !== 'all') {
      startDate = getStartDateForRange(timeRange, now);
      const startIndex = findStartIndexForDate(displayData, startDate);
      if (startIndex !== -1) {
        displayData = displayData.slice(startIndex);
      }
    }

    // Calculate percentage change using TWRR
    if (displayData.length > 0) {
      const baseVnIndex = displayData[0].vnIndex || 1;
      let cumulativeReturn = 1;

      displayData.forEach((d, i) => {
        if (i === 0) {
          d.valuePct = 0;
        } else {
          const prev = displayData[i - 1];
          const cashFlow = cashFlowByDate[d.date] || 0;

          if (prev.value !== null && prev.value > 0) {
            const periodReturn = (d.value! - cashFlow - prev.value) / prev.value;
            cumulativeReturn *= (1 + periodReturn);
            d.twrrDetails = {
              vPrev: prev.value,
              vCurr: d.value,
              cashFlow: cashFlow,
              periodReturn: periodReturn,
              cumulativeReturn: cumulativeReturn
            };
          } else if (prev.value === 0 && d.value! > 0 && cashFlow > 0) {
            d.twrrDetails = {
              vPrev: 0,
              vCurr: d.value,
              cashFlow: cashFlow,
              periodReturn: 0,
              cumulativeReturn: cumulativeReturn
            };
          } else {
            d.twrrDetails = {
              vPrev: prev.value || 0,
              vCurr: d.value,
              cashFlow: cashFlow,
              periodReturn: 0,
              cumulativeReturn: cumulativeReturn
            };
          }
          d.valuePct = (cumulativeReturn - 1) * 100;
        }
        d.vnIndexPct = baseVnIndex > 0 ? ((d.vnIndex - baseVnIndex) / baseVnIndex) * 100 : 0;
      });

      // DOWNSAMPLING: If there are too many points, sample them to save memory/CPU
      const downsampleData = <T extends any>(data: T[], maxPoints = 300): T[] => {
        if (data.length <= maxPoints) return data;
        const step = Math.ceil(data.length / maxPoints);
        return data.filter((_, i) => i === 0 || i === data.length - 1 || i % step === 0);
      };
      displayData = downsampleData(displayData);
    }

    return displayData;
  };

  if (filteredAccounts.length === 0) {
    return <div className="text-center py-8 text-gray-500">Chưa có {title.toLowerCase()} nào. Hãy thêm mới!</div>;
  }

  return (
    <div className="space-y-8">
      {filteredAccounts.map(account => {
        const accountAssets = assets.filter(a => {
          if (a.accountId !== account.id) return false;
          if (a.isFinished) return false;

          // Các loại tài sản đầu tư cần ẩn khi đã bán hết (quantity = 0)
          const isTradeable = ["stock", "etf", "coin", "crypto", "fund", "position"].includes(a.category);

          if (isTradeable) {
            return (a.quantity || 0) > 0;
          }

          // Các loại tài sản khác (tiền mặt, tiết kiệm, vàng, ...) luôn hiển thị
          return true;
        });
        const timeRange = timeRanges[account.id] || '30d';
        const chartData = getChartData(account.id, timeRange);

        let totalValue = 0;
        let investedValue = 0;
        let investedPurchaseValue = 0;

        accountAssets.forEach(asset => {
          const val = getAssetValue(asset, usdtRate);
          totalValue += val;

          const isInvestable = ["stock", "etf", "coin", "crypto", "fund", "position"].includes(asset.category);
          if (isInvestable) {
            investedValue += val;
            investedPurchaseValue += getPurchaseValue(asset, usdtRate);
          }
        });

        // Calculate growth based on current invested holdings only (unrealized P/L)
        const totalGrowth = investedPurchaseValue > 0 ? ((investedValue - investedPurchaseValue) / investedPurchaseValue) * 100 : 0;

        return (
          <Card key={account.id} className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-100 flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-800">{account.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-gray-500">Tổng: <span className="font-semibold text-primary">{showValues ? formatCurrency(totalValue, 'VND') : "****"}</span></p>
                  {totalGrowth !== 0 && (
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={totalGrowth >= 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}>
                        {totalGrowth >= 0 ? "+" : ""}{totalGrowth.toFixed(2)}%
                      </Badge>
                      <span className={`text-[11px] font-bold ${totalGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ({totalGrowth >= 0 ? "+" : ""}{formatCurrency(investedValue - investedPurchaseValue, 'VND')})
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => onEditAccount(account)}>
                  <Edit2 className="w-4 h-4 mr-2" /> Sửa
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteAccountInfo({ id: account.id, name: account.name })}>
                  <Trash2 className="w-4 h-4 mr-2" /> Xóa nguồn
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Row 1: Performance Chart */}
              <div className="h-[350px] w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">Hiệu suất so với VN-Index (%)</h3>
                  
                  <div className="flex bg-gray-100 p-0.5 rounded-md overflow-x-auto">
                    {['7d', '30d', '3m', '6m', '1y', '3y', '5y', 'all'].map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRanges(prev => ({ ...prev, [account.id]: range }))}
                        className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all whitespace-nowrap ${timeRange === range
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
                         range === '5y' ? '5Y' : 'ALL'}
                      </button>
                    ))}
                  </div>
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(val) => format(new Date(val), 'dd/MM')} 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tickFormatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`} 
                        stroke="#94a3b8" 
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-xl text-xs">
                                <p className="font-bold mb-2 text-slate-700">{format(new Date(label), 'dd/MM/yyyy')}</p>
                                {payload.map((entry: any, index: number) => (
                                  <div key={index} className="flex flex-col mb-2 last:mb-0">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                      <span className="font-medium text-gray-600">
                                        {entry.name === 'vnIndexPct' ? 'VN-Index' : 'Portfolio'}:
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
                      <Legend 
                        verticalAlign="top"
                        align="right"
                        height={36}
                        iconType="circle"
                        formatter={(value) => (
                          <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                            {value === 'vnIndexPct' ? 'VN-Index' : 'Portfolio'}
                          </span>
                        )} 
                      />
                      <Line 
                        name="valuePct"
                        type="monotone" 
                        dataKey="valuePct" 
                        stroke="#2563eb" 
                        strokeWidth={3} 
                        dot={false} 
                        activeDot={{ r: 6, strokeWidth: 0 }} 
                      />
                      <Line 
                        name="vnIndexPct"
                        type="monotone" 
                        dataKey="vnIndexPct" 
                        stroke="#94a3b8" 
                        strokeWidth={2} 
                        strokeDasharray="5 5"
                        dot={false} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu lịch sử</div>
                  )}
                </div>

                {/* Row 2: Assets Table Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-500">Danh mục tài sản</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tên</TableHead>
                          <TableHead>Phân loại</TableHead>
                          <TableHead className="text-right">Số lượng</TableHead>
                          <TableHead className="text-right">Giá mua</TableHead>
                          <TableHead className="text-right">Giá HT</TableHead>
                          <TableHead className="text-right">Tăng trưởng</TableHead>
                          <TableHead className="text-right">Tổng</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountAssets.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-gray-500 py-4">Chưa có khoản mục nào</TableCell>
                          </TableRow>
                        ) : (
                          (() => {
                            // Custom sorting: Cash -> Saving -> ETF -> Stock -> Others
                            const sortedAssets = [...accountAssets].sort((a, b) => {
                              const categoryOrder = { 'cash': 0, 'saving': 1, 'etf': 2, 'stock': 3 };
                              const aOrder = categoryOrder[a.category as keyof typeof categoryOrder] ?? 4;
                              const bOrder = categoryOrder[b.category as keyof typeof categoryOrder] ?? 4;

                              if (aOrder !== bOrder) return aOrder - bOrder;

                              if (a.category === 'saving' && b.category === 'saving') {
                                if ((a.interestRate || 0) !== (b.interestRate || 0)) {
                                  return (a.interestRate || 0) - (b.interestRate || 0);
                                }
                                return getAssetValue(a, usdtRate) - getAssetValue(b, usdtRate);
                              }

                              // Group sorting for ETF, Stock, and others: DESC total value
                              return getAssetValue(b, usdtRate) - getAssetValue(a, usdtRate);
                            });

                            return sortedAssets.map(asset => {
                              const isInvest = ["stock", "etf", "coin", "crypto", "fund", "position"].includes(asset.category);
                              const isSimpleAsset = ["usdt", "bot", "position", "usdc"].includes(asset.category);
                              const isCashOrSaving = ["cash", "saving"].includes(asset.category);

                              const totalValueVnd = getAssetValue(asset, usdtRate);
                              const purchasePrice = asset.purchasePrice || asset.currentPrice || 0;
                              const growth = purchasePrice > 0 ? ((asset.currentPrice || 0) - purchasePrice) / purchasePrice * 100 : 0;

                              return (
                                <TableRow key={asset.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                                        {getAssetIcon(asset.category)}
                                      </div>
                                      <div>
                                        <p className="text-sm">{asset.name}</p>
                                        <div className="flex flex-col">
                                          {asset.symbol && <span className="text-[10px] text-gray-400">{asset.symbol}</span>}
                                          {isCashOrSaving && (
                                            <span className="text-[10px] text-green-600 font-medium">
                                              Lãi suất: {asset.category === 'cash' ? '0%' : (asset.interestRate ? `${asset.interestRate}%` : '0%')}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="bg-gray-50 text-xs">{getCategoryLabel(asset.category, type)}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {isInvest && !isSimpleAsset ? (showValues ? asset.quantity?.toLocaleString() : "****") : (showValues ? (asset.balance || 0).toLocaleString() : "****")}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {isInvest && !isSimpleAsset ? (
                                      <div className="flex flex-col items-end">
                                        <span>{showValues ? formatCurrency(purchasePrice, asset.currency) : "****"}</span>
                                        {asset.currency !== 'VND' && showValues && (
                                          <span className="text-[10px] text-gray-400">
                                            ≈ {formatCurrency(purchasePrice * (['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase()) ? usdtRate : 1), 'VND')}
                                          </span>
                                        )}
                                      </div>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {isInvest && !isSimpleAsset ? (
                                      <div className="flex flex-col items-end">
                                        <span>{showValues ? formatCurrency(asset.currentPrice || 0, asset.currency) : "****"}</span>
                                        {asset.currency !== 'VND' && showValues && (
                                          <span className="text-[10px] text-gray-400">
                                            ≈ {formatCurrency((asset.currentPrice || 0) * (['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase()) ? usdtRate : 1), 'VND')}
                                          </span>
                                        )}
                                      </div>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {isCashOrSaving ? (
                                      (() => {
                                        const initial = asset.purchasePrice || 0;
                                        const current = asset.balance || 0;
                                        const profit = current - initial;
                                        if (initial === 0 && current === 0) return <span className="text-gray-400">-</span>;
                                        return (
                                          <span className={`font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                            {profit >= 0 ? "+" : ""}{showValues ? formatCurrency(profit, asset.currency) : "****"}
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      isInvest && !isSimpleAsset && purchasePrice > 0 ? (
                                        <div className="flex flex-col items-end">
                                          <span className={growth >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                            {growth >= 0 ? "+" : ""}{growth.toFixed(2)}%
                                          </span>
                                          <span className={`text-[10px] ${growth >= 0 ? "text-green-500" : "text-red-500"}`}>
                                            {growth >= 0 ? "+" : ""}{showValues ? formatCurrency(((asset.currentPrice || 0) - purchasePrice) * (asset.quantity || 0), asset.currency) : "****"}
                                          </span>
                                        </div>
                                      ) : '-'
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-primary text-sm">{showValues ? formatCurrency(totalValueVnd, 'VND') : "****"}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      {isInvest && !isSimpleAsset && (
                                        <Button variant="ghost" size="icon" onClick={() => onOpenTransactions(asset)} className="h-8 w-8 text-green-500 hover:text-green-700 hover:bg-green-50" title="Lịch sử giao dịch">
                                          <ArrowRightLeft className="w-3 h-3" />
                                        </Button>
                                      )}
                                      <Button variant="ghost" size="icon" onClick={() => onEditAsset(asset)} className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => setDeleteAssetInfo({ id: asset.id, name: asset.name })} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })()
                        )}
                      </TableBody>
                    </Table>
                </div>
              </div>

              {/* Debug Calculation Section (Collapsible) */}
              <details className="mt-8 group border-t border-slate-200 pt-6">
                <summary className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-600 transition-colors list-none">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full group-open:bg-blue-500 group-open:animate-pulse"></div>
                  CÔNG CỤ DEBUG: CHI TIẾT TÍNH TOÁN TWRR ({account.name})
                  <span className="text-[10px] font-normal opacity-60 group-open:hidden">(Click để xem chi tiết công thức và bảng tính)</span>
                </summary>

                <div className="mt-4 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto">
                  <div className="mb-6 p-4 bg-white rounded-xl border border-blue-100 text-xs text-slate-600 leading-relaxed">
                    <p className="font-bold text-blue-700 mb-2">Công thức tính TWRR:</p>
                    <ol className="list-decimal pl-4 space-y-2">
                      <li><strong>Dòng tiền (Cash Flow - CF):</strong> <code className="bg-slate-100 px-1 rounded">CF = (Cost_hiện_tại - Cost_trước) - Lợi_nhuận_đã_chốt</code>.
                        <br /><span className="text-[10px] opacity-70 italic">* Giải thích: Nếu bạn mua thêm, Cost tăng &rarr; CF dương. Nếu bạn bán, Cost giảm và có Lợi nhuận chốt &rarr; CF âm (tiền ra khỏi danh mục đầu tư).</span>
                      </li>
                      <li><strong>Tỷ suất lợi nhuận kỳ (Period Return - r):</strong> <code className="bg-slate-100 px-1 rounded">r = (V_hiện_tại - CF - V_trước) / V_trước</code>.
                        <br /><span className="text-[10px] opacity-70 italic">* Công thức này loại bỏ ảnh hưởng của CF để chỉ tính biến động giá tài sản.</span>
                      </li>
                      <li><strong>Lợi nhuận tích lũy (Cumulative Return):</strong> <code className="bg-slate-100 px-1 rounded">R_tổng = (1 + r1) * (1 + r2) * ... * (1 + rn) - 1</code>.</li>
                    </ol>
                  </div>

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
                        <TableRow key={`twrr-debug-${account.id}-${d.date}`} className="border-slate-100 hover:bg-white transition-colors">
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
                </div>
              </details>

              {/* Debug Section: Transaction History (Per Account) */}
              <details className="mt-4 group border-t border-slate-100 pt-4">
                <summary className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-600 transition-colors list-none">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full group-open:bg-green-500 group-open:animate-pulse"></div>
                  CÔNG CỤ DEBUG: LỊCH SỬ GIAO DỊCH ({account.name})
                  <span className="text-[10px] font-normal opacity-60 group-open:hidden">(Click để xem chi tiết các lệnh mua/bán)</span>
                </summary>

                <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-slate-200">
                        <TableHead className="text-[9px] uppercase text-slate-500">Ngày</TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-500">Tài sản</TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-500">Loại</TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-500 text-right">Số lượng</TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-500 text-right">Giá</TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-500 text-right">Còn lại (FIFO)</TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-500 text-center">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const allAccountAssets = assets.filter(a => a.accountId === account.id);
                        const allAccountAssetIds = allAccountAssets.map(a => a.id);
                        const relevantTxs = investmentTransactions
                          .filter(tx => allAccountAssetIds.includes(tx.assetId))
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                        if (relevantTxs.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-4 text-slate-400 text-[10px] italic">Không có giao dịch nào</TableCell>
                            </TableRow>
                          );
                        }

                        return relevantTxs.map(tx => {
                          const asset = assets.find(a => a.id === tx.assetId);
                          return (
                            <TableRow key={tx.id} className="border-slate-100 hover:bg-white transition-colors">
                              <TableCell className="text-[10px] font-mono text-slate-600">{tx.date}</TableCell>
                              <TableCell className="text-[10px] font-bold text-slate-700">{asset?.name || 'N/A'} ({asset?.symbol || 'N/A'})</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[8px] uppercase px-1 py-0 h-3.5 ${tx.type === 'buy' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                  {tx.type === 'buy' ? 'MUA' : 'BÁN'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-[10px] text-right font-mono">{tx.quantity.toLocaleString()}</TableCell>
                              <TableCell className="text-[10px] text-right font-mono">{tx.price.toLocaleString()} {asset?.currency}</TableCell>
                              <TableCell className="text-[10px] text-right font-mono text-blue-600 font-bold">{tx.type === 'buy' ? tx.remainingQty.toLocaleString() : '-'}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${tx.isClosed ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                  {tx.isClosed ? 'ĐÃ ĐÓNG' : 'MỞ'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </details>
            </CardContent>
          </Card>
        );
      })}

      {/* Modals */}
      <ConfirmModal
        isOpen={!!deleteAccountInfo}
        onClose={() => setDeleteAccountInfo(null)}
        onConfirm={() => deleteAccountInfo && onDeleteAccount(deleteAccountInfo.id)}
        title="Xóa nguồn tài sản"
        description={`Bạn có chắc chắn muốn xóa nguồn "${deleteAccountInfo?.name}"? Tất cả tài sản trong nguồn này cũng sẽ bị xóa.`}
      />

      <ConfirmModal
        isOpen={!!deleteAssetInfo}
        onClose={() => setDeleteAssetInfo(null)}
        onConfirm={() => deleteAssetInfo && onDeleteAsset(deleteAssetInfo.id)}
        title="Xóa tài sản"
        description={`Bạn có chắc chắn muốn xóa tài sản "${deleteAssetInfo?.name}"?`}
      />
    </div>
  );
}
