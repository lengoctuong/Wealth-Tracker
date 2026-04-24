import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Asset } from "../hooks/useAssets";
import { useInvestmentTransactions, InvestmentTransaction } from "../hooks/useTransactions";
import { toast } from "sonner";
import { Upload, Download, History, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { formatCurrency } from "../lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onUpdateAsset: (id: string, updates: Partial<Asset>) => Promise<void>;
}

export function TransactionModal({ isOpen, onClose, asset, onUpdateAsset }: Props) {
  const { transactions, addInvestmentTransaction, deleteInvestmentTransaction, loading: txLoading } = useInvestmentTransactions(asset?.id);
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || !price || !date) {
      toast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setLoading(true);
    try {
      const q = Number(quantity);
      const p = Number(price);
      
      await addInvestmentTransaction({
        assetId: asset.id,
        type,
        quantity: q,
        price: p,
        date,
      });

      // Update asset quantity and average purchase price if it's a buy
      const currentQty = asset.quantity || 0;
      const currentAvgPrice = asset.purchasePrice || asset.currentPrice || 0;
      
      let newQty = currentQty;
      let newAvgPrice = currentAvgPrice;

      if (type === "buy") {
        newQty = currentQty + q;
        newAvgPrice = newQty > 0 ? ((currentQty * currentAvgPrice) + (q * p)) / newQty : p;
      } else {
        newQty = Math.max(0, currentQty - q);
        // Selling doesn't change average purchase price of remaining units
      }

      await onUpdateAsset(asset.id, {
        quantity: newQty,
        purchasePrice: newAvgPrice,
        updatedAt: new Date().toISOString()
      });

      toast.success("Đã thêm giao dịch");
      setQuantity("");
      setPrice("");
    } catch (error) {
      toast.error("Lỗi khi thêm giao dịch");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split("\n");
      const headers = lines[0].split(",");
      
      let successCount = 0;
      let totalQty = asset.quantity || 0;
      let totalCost = (asset.quantity || 0) * (asset.purchasePrice || asset.currentPrice || 0);

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [txDate, txType, txQty, txPrice] = line.split(",");
        if (txDate && txType && txQty && txPrice) {
          const q = Number(txQty);
          const p = Number(txPrice);
          const t = txType.toLowerCase() as "buy" | "sell";

          await addInvestmentTransaction({
            assetId: asset.id,
            type: t,
            quantity: q,
            price: p,
            date: txDate,
          });

          if (t === "buy") {
            totalQty += q;
            totalCost += q * p;
          } else {
            totalQty = Math.max(0, totalQty - q);
          }
          successCount++;
        }
      }

      if (successCount > 0) {
        const newAvgPrice = totalQty > 0 ? totalCost / totalQty : (asset.purchasePrice || 0);
        await onUpdateAsset(asset.id, {
          quantity: totalQty,
          purchasePrice: newAvgPrice,
          updatedAt: new Date().toISOString()
        });
        toast.success(`Đã nhập thành công ${successCount} giao dịch`);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csvContent = "date,type,quantity,price\n2024-03-29,buy,10,150000\n2024-03-30,sell,5,160000";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transaction_template.csv";
    a.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Giao dịch: {asset.name} ({asset.symbol})</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add Form */}
          <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loại</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Mua</SelectItem>
                    <SelectItem value="sell">Bán</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ngày thực hiện</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Số lượng</Label>
                <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" required />
              </div>
              <div className="space-y-2">
                <Label>Giá thực hiện</Label>
                <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" required />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              <Plus className="w-4 h-4 mr-2" /> {loading ? "Đang xử lý..." : "Thêm giao dịch"}
            </Button>
          </form>

          {/* Import/Export */}
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4" /> Lịch sử giao dịch
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" /> Mẫu
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Import CSV
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleImport} />
            </div>
          </div>

          {/* History Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Giá</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4">Đang tải...</TableCell></TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4 text-gray-500">Chưa có giao dịch nào</TableCell></TableRow>
                ) : (
                  transactions.map((tx: InvestmentTransaction) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${tx.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'buy' ? 'MUA' : 'BÁN'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">{tx.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs">{formatCurrency(tx.price, asset.currency)}</TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {formatCurrency(tx.quantity * tx.price, asset.currency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
