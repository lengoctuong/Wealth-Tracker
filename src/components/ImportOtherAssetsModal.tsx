import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Upload, AlertCircle, CheckCircle2, FileJson, Loader2 } from "lucide-react";
import { useAccounts, AccountType, Account } from "../hooks/useAccounts";
import { useAssets } from "../hooks/useAssets";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportOtherAssetsModal({ isOpen, onClose }: Props) {
  const { accounts, addAccount } = useAccounts();
  const { assets, addAsset, updateAsset } = useAssets();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jsonInput, setJsonInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImportData = async (data: any[]) => {
    if (!Array.isArray(data)) {
      throw new Error("Định dạng dữ liệu không hợp lệ. Vui lòng sử dụng mảng JSON.");
    }

    // Filter only non-investment assets
    const otherAssetsData = data.filter(item => 
      !["stock", "etf", "coin", "fund"].includes(item.assetCategory.toLowerCase())
    );

    if (otherAssetsData.length === 0) {
      toast.info("Không tìm thấy tài sản khác (tiết kiệm, tiền mặt...) trong dữ liệu.");
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      let processed = 0;
      const localCreatedAccounts = new Map<string, string>();

      for (const item of otherAssetsData) {
        try {
          // 1. Find or create account
          let accountId: string | undefined;
          
          const existingAccount = accounts.find(a => a.name === item.accountName && a.type === item.accountType);
          if (existingAccount) {
            accountId = existingAccount.id;
          } else if (localCreatedAccounts.has(`${item.accountName}-${item.accountType}`)) {
            accountId = localCreatedAccounts.get(`${item.accountName}-${item.accountType}`);
          } else {
            accountId = await addAccount({
              name: item.accountName,
              type: item.accountType as AccountType
            });
            if (accountId) {
              localCreatedAccounts.set(`${item.accountName}-${item.accountType}`, accountId);
            }
          }

          if (!accountId) continue;

          // 2. Prepare asset data
          const balance = item.balance || 0;
          
          // 3. Find or create asset
          let asset = assets.find(a => a.accountId === accountId && a.symbol === item.assetSymbol);
          
          const assetData: any = {
            accountId: accountId,
            name: item.assetName,
            symbol: item.assetSymbol,
            category: item.assetCategory,
            currency: item.currency || "VND",
            balance: balance,
            // For other assets, purchasePrice is often same as balance initially
            purchasePrice: item.purchasePrice || balance,
            currentPrice: 1, // Default multiplier for balance-based assets
          };

          // Add interest rate for savings
          if (item.assetCategory === "saving" && item.interestRate !== undefined) {
            assetData.interestRate = item.interestRate;
          }

          if (asset) {
            await updateAsset(asset.id, assetData);
          } else {
            await addAsset(assetData);
          }

        } catch (err: any) {
          console.error("Error processing item:", item, err);
          if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
            throw err;
          }
        }

        processed++;
        setProgress(Math.round((processed / otherAssetsData.length) * 100));
      }

      toast.success(`Đã nhập thành công ${processed} tài sản khác.`);
      onClose();
    } catch (error: any) {
      console.error("Import error:", error);
      if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
        toast.error("Hết hạn mức ghi Firestore (20k/ngày). Vui lòng thử lại vào ngày mai!");
      } else {
        toast.error("Lỗi khi nhập dữ liệu. Vui lòng kiểm tra lại dữ liệu JSON.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setJsonInput(text);
      const data = JSON.parse(text);
      await processImportData(data);
    } catch (error) {
      console.error("File read error:", error);
      toast.error("Lỗi khi đọc file. Vui lòng kiểm tra lại.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleManualSubmit = async () => {
    try {
      const data = JSON.parse(jsonInput);
      await processImportData(data);
    } catch (err) {
      toast.error("Dữ liệu JSON không hợp lệ");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nhập Tài Sản Khác (JSON)</DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="bg-blue-50 text-blue-700 p-4 rounded-lg text-sm space-y-2">
            <p className="font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Lưu ý quan trọng:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Chức năng này chỉ nhập các tài sản <strong>không phải đầu tư</strong> (Tiền mặt, Tiết kiệm, USDT, Bot...).</li>
              <li>Các tài sản đầu tư (Cổ phiếu, Crypto, Quỹ) sẽ bị bỏ qua.</li>
              <li>Dữ liệu sẽ được ghi đè nếu tài sản đã tồn tại.</li>
            </ul>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm font-medium">
                <span>Đang xử lý...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Dán nội dung JSON vào đây</Label>
                <Textarea 
                  placeholder='[ { "accountName": "Vietcombank", ... } ]' 
                  className="min-h-[150px] font-mono text-xs"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-[1px] bg-gray-200"></div>
                <span className="text-xs text-gray-400 uppercase">Hoặc</span>
                <div className="flex-1 h-[1px] bg-gray-200"></div>
              </div>

              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <FileJson className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-xs text-gray-600 text-center mb-4">
                  Chọn file JSON chứa dữ liệu tài sản của bạn.
                </p>
                
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".json" 
                  className="hidden" 
                  onChange={handleImport} 
                />
                
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Chọn file JSON
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          {!loading && (
            <Button onClick={handleManualSubmit} disabled={!jsonInput.trim()}>
              Bắt đầu nhập
            </Button>
          )}
          {loading && (
            <Button disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang nhập...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
