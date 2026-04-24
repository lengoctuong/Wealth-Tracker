import React, { useState, useEffect, useRef, useMemo } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts, AccountType, Account } from "../hooks/useAccounts";
import { useAssets, Asset } from "../hooks/useAssets";
import { useAssetHistory } from "../hooks/useAssetHistory";
import { useMarketData } from "../hooks/useMarketData";
import { useTransactions, useInvestmentTransactions } from "../hooks/useTransactions";
import { Button } from "./ui/button";
import { LogOut, Plus, RefreshCw, Clock, Eye, EyeOff, Settings, FileJson } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { AddAccountModal } from "./AddAccountModal";
import { AddAssetModal } from "./AddAssetModal";
import { TransactionModal } from "./TransactionModal";
import { BulkImportModal } from "./BulkImportModal";
import { SettingsModal } from "./SettingsModal";
import { ImportOtherAssetsModal } from "./ImportOtherAssetsModal";
import { OverviewTab } from "./tabs/OverviewTab";
import { InvestmentTab } from "./tabs/InvestmentTab";
import { StandardTab } from "./tabs/StandardTab";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { configService } from "../services/configService";
import { marketService } from "../services/marketService";

export function Dashboard() {
  const { user, logOut } = useAuth();
  const { accounts, loading: accountsLoading, addAccount, updateAccount, deleteAccount, clearAccounts } = useAccounts();
  const { assets: rawAssets, loading: assetsLoading, addAsset, updateAsset, deleteAsset, clearAssets } = useAssets();
  const assets = rawAssets.filter(a => !a.isFinished && (a.quantity === undefined || a.quantity > 0 || !['stock', 'etf', 'coin', 'fund'].includes(a.category)));
  const { 
    transactions: investmentTransactions, 
    clearInvestmentTransactions,
    rebuildFIFOLayers 
  } = useInvestmentTransactions();
  const { transactions: regularTransactions } = useTransactions();
  
  const earliestTransactionDate = useMemo(() => {
    if (investmentTransactions.length === 0) return null;
    return investmentTransactions.reduce((earliest, tx) => {
      return tx.date < earliest ? tx.date : earliest;
    }, investmentTransactions[0].date);
  }, [investmentTransactions]);

  const { vnIndex: marketVnIndex, vnIndexHistory } = useMarketData(earliestTransactionDate);
  const [manualVnIndex, setManualVnIndex] = useState<number | null>(null);
  const vnIndex = manualVnIndex !== null ? { price: manualVnIndex, change: 0, changePercent: 0, date: new Date().toISOString() } : marketVnIndex;
  const [usdtRate, setUsdtRate] = useState(25500);
  const { history, backfillHistory, isBackfilling, backfillProgress } = useAssetHistory(rawAssets, vnIndex?.price || 0, usdtRate);
  
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isImportOtherOpen, setIsImportOtherOpen] = useState(false);
  const [selectedAssetForTx, setSelectedAssetForTx] = useState<Asset | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>(undefined);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [isEditingVnIndex, setIsEditingVnIndex] = useState(false);
  const [tempVnIndex, setTempVnIndex] = useState("");
  const [isEditingUsdt, setIsEditingUsdt] = useState(false);
  const [tempUsdt, setTempUsdt] = useState("25500");
  const [showValues, setShowValues] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", user.uid));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.usdtRate) {
            setUsdtRate(data.usdtRate);
            setTempUsdt(data.usdtRate.toString());
          }
          if (data.vnIndexPrice) {
            setManualVnIndex(data.vnIndexPrice);
          }
          if (data.backendUrl) {
            marketService.setBackendUrl(data.backendUrl);
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, [user]);

  const handleUpdateBackendUrl = async (url: string) => {
    if (!user) return;
    await configService.setBackendUrl(user.uid, url);
    marketService.setBackendUrl(url);
  };

  const saveSettings = async (updates: any) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "settings", user.uid), updates, { merge: true });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefreshPrices = async () => {
    setRefreshingPrices(true);
    setUpdateProgress(0);
    let updatedCount = 0;
    const failedSymbols: string[] = [];
    const successSymbols: string[] = [];
    
    const assetsToUpdate = assets.filter(a => a.symbol);
    const total = assetsToUpdate.length;
    
    if (total === 0) {
      setRefreshingPrices(false);
      toast.info("Không có tài sản nào có mã (symbol) để cập nhật giá.");
      return;
    }

    // Current date for freshness check
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Format YYYY-MM-DD for API start parameter (optional optimization)
    const startDate = oneWeekAgo.toISOString().split('T')[0];

    try {
      for (let i = 0; i < assetsToUpdate.length; i++) {
        const asset = assetsToUpdate[i];
        const symbol = asset.symbol!.toUpperCase();
        let result: { value: number, timestamp: string } | null = null;

        try {
          if (asset.category === 'stock' || asset.category === 'etf') {
            result = await marketService.getStockPrice(symbol, startDate);
          } else if (asset.category === 'fund') {
            result = await marketService.getFundPrice(symbol, startDate);
          } else if (asset.category === 'coin' || asset.category === 'crypto') {
            const ticker = symbol.includes('-') ? symbol : `${symbol}-USD`;
            result = await marketService.getCryptoPrice(ticker, startDate);
          } else if (asset.category === 'gold') {
            result = await marketService.getGoldPrice(symbol.toLowerCase() || 'sjc', 'sell', startDate);
          }

          if (result) {
            const dataDate = new Date(result.timestamp);
            // If data is older than 1 week, consider it as no data
            if (dataDate < oneWeekAgo) {
              console.warn(`Data for ${symbol} is too old: ${result.timestamp}`);
              failedSymbols.push(symbol);
            } else {
              if (result.value !== asset.currentPrice) {
                await updateAsset(asset.id, { currentPrice: result.value });
                updatedCount++;
              }
              successSymbols.push(symbol);
            }
          } else {
            failedSymbols.push(symbol);
          }
        } catch (err) {
          console.error(`Failed to update ${symbol}`, err);
          failedSymbols.push(symbol);
        }
        
        setUpdateProgress(Math.round(((i + 1) / total) * 100));
      }
      
      if (failedSymbols.length > 0) {
        toast.warning(
          <div>
            <p className="font-bold">Cập nhật hoàn tất với một số lỗi:</p>
            <p>Thành công: {updatedCount} ({successSymbols.join(', ')})</p>
            <p>Thất bại: {failedSymbols.length} ({failedSymbols.join(', ')})</p>
          </div>,
          { duration: 5000 }
        );
      } else {
        toast.success(`Đã cập nhật giá thành công cho ${updatedCount} tài sản.`);
      }
    } catch (error) {
      console.error("Refresh prices failed", error);
      toast.error("Lỗi khi cập nhật giá tài sản");
    } finally {
      setRefreshingPrices(false);
      setUpdateProgress(0);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const handleExportInvestmentData = () => {
    const data = {
      accounts,
      assets: rawAssets.filter(a => ['stock', 'etf', 'coin', 'fund'].includes(a.category)),
      transactions: investmentTransactions,
      exportDate: new Date().toISOString(),
      version: "1.0"
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investment-backup-${format(new Date(), 'yyyyMMdd-HHmm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportOtherAssetsData = () => {
    const data = {
      accounts,
      assets: rawAssets.filter(a => !['stock', 'etf', 'coin', 'fund'].includes(a.category)),
      transactions: regularTransactions,
      exportDate: new Date().toISOString(),
      version: "1.0"
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `other-assets-backup-${format(new Date(), 'yyyyMMdd-HHmm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAllData = async () => {
    try {
      await clearAssets();
      await clearAccounts();
      await clearInvestmentTransactions();
      toast.success("Đã xóa toàn bộ dữ liệu thành công!");
    } catch (error) {
      console.error("Clear all data failed", error);
      toast.error("Lỗi khi xóa dữ liệu!");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      // Delete all assets in this account first
      const accountAssets = rawAssets.filter(a => a.accountId === id);
      const promises = accountAssets.map(a => deleteAsset(a.id));
      await Promise.all(promises);
      
      // Then delete the account
      await deleteAccount(id);
      toast.success("Đã xóa nguồn tài sản thành công");
    } catch (error) {
      console.error("Delete account failed", error);
      toast.error("Lỗi khi xóa nguồn tài sản");
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
      await deleteAsset(id);
      toast.success("Đã xóa tài sản thành công");
    } catch (error) {
      console.error("Delete asset failed", error);
      toast.error("Lỗi khi xóa tài sản");
    }
  };

  const handleSyncHistory = async () => {
    try {
      // 1. Refresh prices first
      await handleRefreshPrices();
      
      // 2. Rebuild FIFO layers for all transactions
      await rebuildFIFOLayers();
      
      // 3. Then backfill history
      await backfillHistory(investmentTransactions);
      
      toast.success("Đã đồng bộ lịch sử và cập nhật giá thành công!");
    } catch (error) {
      console.error("Sync history failed", error);
      toast.error("Lỗi khi đồng bộ lịch sử!");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Wealth Tracker</h1>
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              <Clock className="w-4 h-4" />
              {format(currentTime, "HH:mm:ss - dd/MM/yyyy", { locale: vi })}
            </div>
            {vnIndex && (
              <div className="hidden md:flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full bg-blue-50 text-blue-700">
                {isEditingVnIndex ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      className="w-20 bg-white border border-blue-200 rounded px-1 py-0.5 text-xs focus:outline-none"
                      value={tempVnIndex}
                      onChange={(e) => setTempVnIndex(e.target.value)}
                      autoFocus
                      onBlur={() => {
                        if (tempVnIndex) {
                          const newPrice = Number(tempVnIndex);
                          setManualVnIndex(newPrice);
                          saveSettings({ vnIndexPrice: newPrice });
                        }
                        setIsEditingVnIndex(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (tempVnIndex) {
                            const newPrice = Number(tempVnIndex);
                            setManualVnIndex(newPrice);
                            saveSettings({ vnIndexPrice: newPrice });
                          }
                          setIsEditingVnIndex(false);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1 cursor-pointer" onClick={() => {
                    setTempVnIndex(vnIndex.price.toString());
                    setIsEditingVnIndex(true);
                  }}>
                    VN-INDEX: {vnIndex.price.toLocaleString()} 
                    <span className={vnIndex.change >= 0 ? "text-green-600" : "text-red-600"}>
                      ({vnIndex.change >= 0 ? "+" : ""}{vnIndex.change})
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="hidden md:flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full bg-green-50 text-green-700">
              {isEditingUsdt ? (
                <input 
                  type="number" 
                  className="w-16 bg-white border border-green-200 rounded px-1 py-0.5 text-xs focus:outline-none"
                  value={tempUsdt}
                  onChange={(e) => setTempUsdt(e.target.value)}
                  autoFocus
                  onBlur={() => {
                    if (tempUsdt) {
                      const newRate = Number(tempUsdt);
                      setUsdtRate(newRate);
                      saveSettings({ usdtRate: newRate });
                    }
                    setIsEditingUsdt(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (tempUsdt) {
                        const newRate = Number(tempUsdt);
                        setUsdtRate(newRate);
                        saveSettings({ usdtRate: newRate });
                      }
                      setIsEditingUsdt(false);
                    }
                  }}
                />
              ) : (
                <div className="cursor-pointer" onClick={() => {
                  setTempUsdt(usdtRate.toString());
                  setIsEditingUsdt(true);
                }}>
                  USDT: {usdtRate.toLocaleString()}
                </div>
              )}
            </div>
          </div>
            <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} title="Cài đặt">
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowValues(!showValues)} title={showValues ? "Ẩn số dư" : "Hiện số dư"}>
              {showValues ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </Button>
            <span className="text-sm text-gray-600 hidden sm:inline-block">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={logOut} title="Đăng xuất">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="w-full space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="bg-white border border-gray-200 shadow-sm flex-wrap h-auto">
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="bank">Ngân hàng</TabsTrigger>
              <TabsTrigger value="ewallet">Ví điện tử</TabsTrigger>
              <TabsTrigger value="fintech">Fintech</TabsTrigger>
              <TabsTrigger value="brokerage">Chứng khoán</TabsTrigger>
              <TabsTrigger value="crypto">Crypto</TabsTrigger>
              <TabsTrigger value="other">Khác</TabsTrigger>
            </TabsList>
            <div className="flex gap-2 flex-wrap">
              {isBackfilling && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm border border-blue-100">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang đồng bộ lịch sử ({backfillProgress}%)
                </div>
              )}
              <Button onClick={handleRefreshPrices} variant="outline" size="sm" disabled={refreshingPrices || isBackfilling}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshingPrices ? 'animate-spin' : ''}`} /> 
                {refreshingPrices ? `Đang cập nhật (${updateProgress}%)` : 'Làm mới giá'}
              </Button>
              <Button onClick={() => setIsAddAccountOpen(true)} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" /> Nguồn
              </Button>
              <Button onClick={() => setIsAddAssetOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" /> Tài sản
              </Button>
            </div>
          </div>

          <TabsContent value="overview">
            <OverviewTab 
              accounts={accounts} 
              assets={rawAssets} 
              history={history} 
              vnIndexHistory={vnIndexHistory} 
              vnIndex={vnIndex} 
              investmentTransactions={investmentTransactions}
              isBackfilling={isBackfilling || refreshingPrices}
              onBackfill={handleSyncHistory}
              usdtRate={usdtRate} 
              showValues={showValues} 
            />
          </TabsContent>

          <TabsContent value="bank">
            <StandardTab 
              type="bank" 
              title="Tài khoản Ngân hàng" 
              accounts={accounts} 
              assets={assets} 
              transactions={regularTransactions}
              usdtRate={usdtRate}
              showValues={showValues}
              onDeleteAsset={handleDeleteAsset} 
              onDeleteAccount={handleDeleteAccount}
              onEditAsset={(asset) => { setEditingAsset(asset); setIsAddAssetOpen(true); }}
              onEditAccount={(account) => { setEditingAccount(account); setIsAddAccountOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="ewallet">
            <StandardTab 
              type="ewallet" 
              title="Ví điện tử" 
              accounts={accounts} 
              assets={assets} 
              transactions={regularTransactions}
              usdtRate={usdtRate}
              showValues={showValues}
              onDeleteAsset={handleDeleteAsset} 
              onDeleteAccount={handleDeleteAccount}
              onEditAsset={(asset) => { setEditingAsset(asset); setIsAddAssetOpen(true); }}
              onEditAccount={(account) => { setEditingAccount(account); setIsAddAccountOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="fintech">
            <InvestmentTab 
              type="fintech" 
              title="Tài khoản Fintech" 
              accounts={accounts} 
              assets={rawAssets} 
              history={history} 
              vnIndexHistory={vnIndexHistory} 
              investmentTransactions={investmentTransactions}
              usdtRate={usdtRate}
              showValues={showValues}
              onDeleteAsset={handleDeleteAsset} 
              onDeleteAccount={handleDeleteAccount}
              onEditAsset={(asset) => { setEditingAsset(asset); setIsAddAssetOpen(true); }}
              onEditAccount={(account) => { setEditingAccount(account); setIsAddAccountOpen(true); }}
              onOpenTransactions={(asset) => { setSelectedAssetForTx(asset); setIsTransactionModalOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="brokerage">
            <InvestmentTab 
              type="brokerage" 
              title="Tài khoản Chứng khoán" 
              accounts={accounts} 
              assets={rawAssets} 
              history={history} 
              vnIndexHistory={vnIndexHistory} 
              investmentTransactions={investmentTransactions}
              usdtRate={usdtRate}
              showValues={showValues}
              onDeleteAsset={handleDeleteAsset} 
              onDeleteAccount={handleDeleteAccount}
              onEditAsset={(asset) => { setEditingAsset(asset); setIsAddAssetOpen(true); }}
              onEditAccount={(account) => { setEditingAccount(account); setIsAddAccountOpen(true); }}
              onOpenTransactions={(asset) => { setSelectedAssetForTx(asset); setIsTransactionModalOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="crypto">
            <InvestmentTab 
              type="crypto" 
              title="Tài khoản Crypto" 
              accounts={accounts} 
              assets={rawAssets} 
              history={history} 
              vnIndexHistory={vnIndexHistory} 
              investmentTransactions={investmentTransactions}
              usdtRate={usdtRate}
              showValues={showValues}
              onDeleteAsset={handleDeleteAsset} 
              onDeleteAccount={handleDeleteAccount}
              onEditAsset={(asset) => { setEditingAsset(asset); setIsAddAssetOpen(true); }}
              onEditAccount={(account) => { setEditingAccount(account); setIsAddAccountOpen(true); }}
              onOpenTransactions={(asset) => { setSelectedAssetForTx(asset); setIsTransactionModalOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="other">
            <StandardTab 
              type="other" 
              title="Tài sản khác" 
              accounts={accounts} 
              assets={assets} 
              transactions={regularTransactions}
              usdtRate={usdtRate}
              showValues={showValues}
              onDeleteAsset={handleDeleteAsset} 
              onDeleteAccount={handleDeleteAccount}
              onEditAsset={(asset) => { setEditingAsset(asset); setIsAddAssetOpen(true); }}
              onEditAccount={(account) => { setEditingAccount(account); setIsAddAccountOpen(true); }}
            />
          </TabsContent>
        </Tabs>
      </main>

      <AddAccountModal 
        isOpen={isAddAccountOpen} 
        onClose={() => { setIsAddAccountOpen(false); setEditingAccount(undefined); }} 
        onAdd={addAccount}
        onUpdate={updateAccount}
        editingAccount={editingAccount}
      />
      <AddAssetModal 
        isOpen={isAddAssetOpen} 
        onClose={() => { setIsAddAssetOpen(false); setEditingAsset(undefined); }} 
        onAdd={addAsset}
        onUpdate={updateAsset}
        editingAsset={editingAsset}
        accounts={accounts} 
      />
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => { setIsTransactionModalOpen(false); setSelectedAssetForTx(null); }}
        asset={selectedAssetForTx}
        onUpdateAsset={updateAsset}
      />
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
      />
      <ImportOtherAssetsModal
        isOpen={isImportOtherOpen}
        onClose={() => setIsImportOtherOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onExportInvestment={handleExportInvestmentData}
        onExportOtherAssets={handleExportOtherAssetsData}
        onBulkImport={() => setIsBulkImportOpen(true)}
        onImportOtherAssets={() => setIsImportOtherOpen(true)}
        onClearAll={handleClearAllData}
        onUpdateBackendUrl={handleUpdateBackendUrl}
      />
    </div>
  );
}
