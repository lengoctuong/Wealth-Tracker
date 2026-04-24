import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Asset } from "../hooks/useAssets";
import { Account } from "../hooks/useAccounts";
import { toast } from "sonner";

import { marketService } from "../services/marketService";
import { RefreshCw } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (asset: Omit<Asset, "id" | "userId" | "updatedAt">) => Promise<string | null>;
  onUpdate?: (id: string, updates: Partial<Asset>) => Promise<void>;
  editingAsset?: Asset | null;
  accounts: Account[];
}

export function AddAssetModal({ isOpen, onClose, onAdd, onUpdate, editingAsset, accounts }: Props) {
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("cash");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [balance, setBalance] = useState("");
  const [customName, setCustomName] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [interestRate, setInterestRate] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  const handleFetchPrice = async () => {
    if (!symbol) {
      toast.error("Vui lòng nhập mã (symbol) trước");
      return;
    }

    setFetchingPrice(true);
    try {
      const upperSymbol = symbol.toUpperCase();
      let result: { value: number, timestamp: string } | null = null;
      
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      if (category === 'stock' || category === 'etf') {
        result = await marketService.getStockPrice(upperSymbol);
      } else if (category === 'fund') {
        result = await marketService.getFundPrice(upperSymbol);
      } else if (category === 'coin' || category === 'crypto') {
        const ticker = upperSymbol.includes('-') ? upperSymbol : `${upperSymbol}-USD`;
        result = await marketService.getCryptoPrice(ticker);
      } else if (category === 'gold') {
        result = await marketService.getGoldPrice(upperSymbol.toLowerCase() || 'sjc');
      }

      if (result) {
        const dataDate = new Date(result.timestamp);
        if (dataDate < oneWeekAgo) {
          toast.warning(`Dữ liệu cho ${upperSymbol} đã quá cũ (${new Date(result.timestamp).toLocaleDateString()})`);
        } else {
          setCurrentPrice(result.value.toString());
          toast.success(`Đã lấy giá mới nhất cho ${upperSymbol}: ${result.value.toLocaleString()} ${currency}`);
        }
      } else {
        toast.error("Không tìm thấy giá cho mã này");
      }
    } catch (error) {
      console.error("Fetch price error:", error);
      toast.error("Lỗi khi lấy giá từ máy chủ");
    } finally {
      setFetchingPrice(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (editingAsset) {
        setAccountId(editingAsset.accountId);
        setCategory(editingAsset.category);
        setSymbol(editingAsset.symbol || "");
        setQuantity(editingAsset.quantity?.toString() || "");
        setPurchasePrice(editingAsset.purchasePrice?.toString() || editingAsset.currentPrice?.toString() || "");
        setCurrentPrice(editingAsset.currentPrice?.toString() || "");
        setBalance(editingAsset.balance?.toString() || "");
        setCustomName(editingAsset.name || "");
        setCurrency(editingAsset.currency);
        setInterestRate(editingAsset.interestRate?.toString() || "");
        setPurchaseDate(editingAsset.purchaseDate || new Date().toISOString().split('T')[0]);
      } else {
        setAccountId(accounts.length > 0 ? accounts[0].id : "");
        setCategory("cash");
        setSymbol("");
        setQuantity("");
        setPurchasePrice("");
        setCurrentPrice("");
        setBalance("");
        setCustomName("");
        setCurrency("VND");
        setInterestRate("");
        setPurchaseDate(new Date().toISOString().split('T')[0]);
      }
    }
  }, [isOpen, accounts, editingAsset]);

  useEffect(() => {
    if (category === "usdt" || category === "usdc") {
      setCurrency("USDT");
    }
  }, [category]);

  const selectedAccount = accounts.find(a => a.id === accountId);

  const getCategoriesForAccount = (type?: string) => {
    switch (type) {
      case "brokerage": return [
        { value: "stock", label: "Cổ phiếu" },
        { value: "etf", label: "Chứng chỉ quỹ ETF" },
        { value: "cash", label: "Tiền mặt" },
        { value: "saving", label: "Tiền gửi tiết kiệm" }
      ];
      case "crypto": return [
        { value: "usdt", label: "USDT / Stablecoin" },
        { value: "coin", label: "Coin / Token" },
        { value: "bot", label: "Bot Trading" }
      ];
      case "ewallet": return [
        { value: "cash", label: "Tiền mặt" },
        { value: "saving", label: "Túi thần tài / Tiết kiệm" }
      ];
      case "fintech": return [
        { value: "saving", label: "Tiết kiệm" },
        { value: "fund", label: "Chứng chỉ quỹ" }
      ];
      case "bank": return [
        { value: "cash", label: "Tiền mặt" },
        { value: "saving", label: "Gửi tiết kiệm" }
      ];
      case "polymarket": return [
        { value: "position", label: "Vị thế (Position)" },
        { value: "usdc", label: "USDC" }
      ];
      default: return [
        { value: "cash", label: "Tiền mặt" },
        { value: "other", label: "Khác" }
      ];
    }
  };

  const categories = getCategoriesForAccount(selectedAccount?.type);
  const isInvest = ["stock", "etf", "coin", "crypto", "fund", "position"].includes(category);
  const isSimpleAsset = ["usdt", "bot", "position", "usdc"].includes(category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      toast.error("Vui lòng chọn nguồn tài sản");
      return;
    }
    
    if (isInvest && !isSimpleAsset && !symbol) {
      toast.error("Vui lòng nhập mã tài sản");
      return;
    }

    setLoading(true);
    try {
      const finalName = (isInvest && !isSimpleAsset) ? symbol.toUpperCase() : (customName || categories.find(c => c.value === category)?.label || category);
      
      const assetData: any = {
        accountId,
        category,
        name: finalName,
        currency,
        balance: (isInvest && !isSimpleAsset) ? 0 : Number(balance) || 0,
        purchasePrice: isSimpleAsset ? 0 : Number(purchasePrice) || 0,
        purchaseDate: isInvest ? purchaseDate : undefined,
        currentPrice: isSimpleAsset ? 0 : (Number(currentPrice) || Number(purchasePrice) || Number(balance) || 0),
        interestRate: category === 'saving' ? Number(interestRate) || 0 : 0,
      };

      if (isInvest && !isSimpleAsset) {
        assetData.symbol = symbol.toUpperCase();
        assetData.quantity = Number(quantity) || 0;
      }

      if (editingAsset && onUpdate) {
        await onUpdate(editingAsset.id, assetData);
        toast.success("Cập nhật tài sản thành công");
      } else {
        await onAdd(assetData);
        toast.success("Thêm tài sản thành công");
      }
      onClose();
    } catch (error) {
      toast.error("Lỗi khi xử lý tài sản");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingAsset ? "Chỉnh Sửa Tài Sản" : "Thêm Khoản Mục Tài Sản"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nguồn tài sản</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn nguồn" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Phân loại</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn phân loại" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(isSimpleAsset || category === 'other') && (
            <div className="space-y-2">
              <Label>{category === 'bot' ? "Tên Bot" : "Tên tài sản"}</Label>
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={category === 'bot' ? "VD: Bot Grid, Bot Trend" : "Tên tùy chỉnh"} />
            </div>
          )}

          {isInvest && !isSimpleAsset && (
            <div className="space-y-2">
              <Label>Ngày thực hiện</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
            </div>
          )}

          {isInvest && !isSimpleAsset && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mã (Symbol)</Label>
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="VD: HPG, BTC" required />
              </div>
              <div className="space-y-2">
                <Label>Số lượng</Label>
                <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" required />
              </div>
            </div>
          )}

          {(!isInvest || isSimpleAsset) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Số dư hiện tại</Label>
                <Input type="number" step="any" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" required />
              </div>
              {category === 'saving' && (
                <div className="space-y-2">
                  <Label>Lãi suất (%/năm)</Label>
                  <Input type="number" step="any" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="0" />
                </div>
              )}
            </div>
          )}

          {!isSimpleAsset && category !== 'saving' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isInvest ? "Đơn giá mua" : "Giá trị lúc đầu"}</Label>
                <Input type="number" step="any" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>{isInvest ? "Giá hiện tại" : "Giá trị hiện tại"}</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    step="any" 
                    value={currentPrice} 
                    onChange={(e) => setCurrentPrice(e.target.value)} 
                    placeholder="0" 
                  />
                  {isInvest && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={handleFetchPrice}
                      disabled={fetchingPrice}
                      title="Lấy giá mới nhất"
                    >
                      <RefreshCw className={`w-4 h-4 ${fetchingPrice ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Đơn vị tiền tệ</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn tiền tệ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VND">VND</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="USDT">USDT</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={loading}>{loading ? "Đang lưu..." : "Lưu tài sản"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
