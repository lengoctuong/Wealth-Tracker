import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { FileJson, Upload, Download, Loader2, AlertCircle } from "lucide-react";
import { useAccounts } from "../hooks/useAccounts";
import { Asset, useAssets } from "../hooks/useAssets";
import { useInvestmentTransactions } from "../hooks/useTransactions";
import { Progress } from "./ui/progress";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSyncMarketPrices?: (importedAssets?: Asset[]) => Promise<void>;
}

interface ImportTransaction {
  date: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
}

interface ImportAsset {
  accountName: string;
  accountType: "bank" | "brokerage" | "fintech" | "ewallet" | "crypto" | "polymarket" | "cash" | "other";
  assetName: string;
  assetSymbol: string;
  assetCategory: string;
  currency: string;
  transactions: ImportTransaction[];
}

export function BulkImportModal({ isOpen, onClose, onSyncMarketPrices }: Props) {
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { accounts, addAccount } = useAccounts();
  const { assets, addAsset, updateAsset } = useAssets();
  const { transactions: investmentTransactions, addInvestmentTransaction } = useInvestmentTransactions();

  const handleBulkImport = async (rawData: ImportAsset[]) => {
    setLoading(true);
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const importedAssets: Asset[] = [];
    
    // Filter only investment assets
    const data = rawData.filter(item => 
      ["stock", "etf", "coin", "fund"].includes(item.assetCategory.toLowerCase())
    );

    if (data.length === 0) {
      toast.info("Không tìm thấy tài sản đầu tư (Cổ phiếu, Crypto, Quỹ) trong dữ liệu.");
      setLoading(false);
      return;
    }

    // Danh sách tạm để theo dõi tài khoản vừa tạo trong phiên nhập này
    const localCreatedAccounts: Record<string, string> = {};

    try {
      const totalItems = data.length;
      let currentIndex = 0;

      for (const item of data) {
        currentIndex++;
        const currentProgress = Math.round((currentIndex / totalItems) * 100);
        setProgress(currentProgress);
        setStatusText(`Đang nhập ${item.assetSymbol} (${currentIndex}/${totalItems})...`);

        try {
          // 1. Find or create account
          const accountKey = `${item.accountName}-${item.accountType}`;
          let accountId = localCreatedAccounts[accountKey];
          
          if (!accountId) {
            const existingAccount = accounts.find(a => a.name === item.accountName && a.type === item.accountType);
            if (existingAccount) {
              accountId = existingAccount.id;
              localCreatedAccounts[accountKey] = accountId; // Add this to prevent duplicate lookups
            } else {
              accountId = await addAccount({
                name: item.accountName,
                type: item.accountType,
              });
              if (!accountId) throw new Error(`Failed to create account ${item.accountName}`);
              localCreatedAccounts[accountKey] = accountId;
            }
          }

          // 3. Find or create asset (metadata only)
          let asset = assets.find(a => a.accountId === accountId && a.symbol === item.assetSymbol);
          let assetId = asset?.id;

          const lastPrice = item.transactions.length > 0 ? item.transactions[item.transactions.length - 1].price : 0;

          const assetData = {
            accountId: accountId!,
            name: item.assetName,
            symbol: item.assetSymbol,
            category: item.assetCategory,
            currency: item.currency,
            currentPrice: lastPrice,
          };

          if (!assetId) {
            assetId = await addAsset(assetData);
            if (assetId) {
              importedAssets.push({ id: assetId, ...assetData } as Asset);
            }
          } else {
            // Only update if metadata changed
            if (asset.currentPrice !== lastPrice || asset.name !== item.assetName) {
              await updateAsset(assetId, {
                currentPrice: lastPrice,
                name: item.assetName,
              });
            }
            importedAssets.push({ id: assetId, ...assetData, currentPrice: lastPrice, name: item.assetName } as Asset);
          }

          // 4. Add all transactions (FIFO logic is inside addInvestmentTransaction)
          if (assetId) {
            const sortedTxs = [...item.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            for (const tx of sortedTxs) {
              // Check for duplicate transaction
              const isDuplicate = (investmentTransactions || []).some(existing => 
                existing.assetId === assetId &&
                existing.date === tx.date &&
                existing.type === tx.type &&
                existing.quantity === tx.quantity &&
                Math.abs(existing.price - tx.price) < 0.01
              );

              if (isDuplicate) {
                skipCount++;
                continue;
              }

              await addInvestmentTransaction({
                assetId: assetId,
                type: tx.type,
                quantity: tx.quantity,
                price: tx.price,
                date: tx.date,
              });
            }
          }

          successCount++;
        } catch (err: any) {
          console.error(`Error importing asset ${item.assetSymbol}:`, err);
          // If it's a quota error, stop the whole process and bubble up
          if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
            throw err;
          }
          errorCount++;
        }
      }

      toast.success(`Đã nhập thành công ${successCount} tài sản. ${skipCount > 0 ? `Đã bỏ qua ${skipCount} giao dịch trùng.` : ""} ${errorCount > 0 ? `Có ${errorCount} lỗi.` : ""}`);
      
      if (onSyncMarketPrices && successCount > 0) {
        setStatusText("Đang đồng bộ giá thị trường...");
        setProgress(100);
        await onSyncMarketPrices(importedAssets);
      }

      if (errorCount === 0) onClose();
    } catch (error: any) {
      console.error("Import error:", error);
      if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
        toast.error("Hết hạn mức ghi Firestore (20k/ngày). Vui lòng thử lại vào ngày mai!");
      } else {
        toast.error("Lỗi hệ thống khi nhập dữ liệu");
      }
    } finally {
      setLoading(false);
      setProgress(0);
      setStatusText("");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonInput(content);
        const data = JSON.parse(content);
        handleBulkImport(data);
      } catch (err) {
        toast.error("Tệp JSON không hợp lệ");
      }
    };
    reader.readAsText(file);
  };

  const handleManualSubmit = () => {
    try {
      const data = JSON.parse(jsonInput);
      if (!Array.isArray(data)) {
        toast.error("Dữ liệu phải là một mảng các tài sản");
        return;
      }
      handleBulkImport(data);
    } catch (err) {
      toast.error("Dữ liệu JSON không hợp lệ");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-primary" /> Nhập giao dịch đầu tư (JSON)
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-blue-50 text-blue-700 p-4 rounded-lg text-sm space-y-2">
            <p className="font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Lưu ý quan trọng:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Chức năng này chỉ nhập các tài sản <strong>đầu tư</strong> (Cổ phiếu, Crypto, Quỹ).</li>
              <li>Các tài sản khác (Tiền mặt, Tiết kiệm...) sẽ bị bỏ qua.</li>
              <li>Dữ liệu sẽ được thêm vào lịch sử giao dịch.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label>Dán nội dung JSON vào đây</Label>
            <Textarea 
              placeholder='[ { "accountName": "VNDIRECT", ... } ]' 
              className="min-h-[200px] font-mono text-xs"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              disabled={loading}
            />
          </div>

          {loading && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between text-xs text-gray-500 font-medium">
                <span>{statusText}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex-1 h-[1px] bg-gray-200"></div>
            <span className="text-xs text-gray-400 uppercase">Hoặc</span>
            <div className="flex-1 h-[1px] bg-gray-200"></div>
          </div>

          <div className="flex justify-center">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <Upload className="w-4 h-4 mr-2" /> Tải tệp JSON lên
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".json" 
              onChange={onFileChange} 
            />
          </div>

          <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Lưu ý:</strong> Hệ thống sẽ tự động tạo tài khoản và tài sản nếu chưa tồn tại. 
              Nếu tài sản sau khi tính toán giao dịch có số lượng bằng 0, nó sẽ không hiển thị trong danh sách tài sản đang hoạt động nhưng lịch sử giao dịch vẫn được lưu lại.
            </p>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <a href="/import_template.json" download="template.json" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
            <Download className="w-4 h-4 mr-2" /> Tải mẫu JSON
          </a>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Hủy</Button>
            <Button onClick={handleManualSubmit} disabled={loading || !jsonInput.trim()}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Bắt đầu nhập
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
