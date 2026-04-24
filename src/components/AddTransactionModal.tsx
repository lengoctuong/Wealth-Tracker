import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Transaction } from "../hooks/useTransactions";
import { Asset } from "../hooks/useAssets";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (tx: Omit<Transaction, "id" | "userId" | "createdAt">) => Promise<void>;
  assets: Asset[];
}

export function AddTransactionModal({ isOpen, onClose, onAdd, assets }: Props) {
  const [type, setType] = useState<Transaction["type"]>("expense");
  const [assetId, setAssetId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType("expense");
      setAssetId(assets.length > 0 ? assets[0].id : "");
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(format(new Date(), "yyyy-MM-dd"));
    }
  }, [isOpen, assets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId) {
      toast.error("Vui lòng chọn tài sản");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return;
    }
    if (!category) {
      toast.error("Vui lòng nhập danh mục");
      return;
    }

    setLoading(true);
    try {
      await onAdd({
        type,
        assetId,
        amount: Number(amount),
        category,
        description,
        date: new Date(date).toISOString(),
      });
      toast.success("Thêm giao dịch thành công");
      onClose();
    } catch (error) {
      toast.error("Lỗi khi thêm giao dịch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm giao dịch mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loại giao dịch</Label>
              <Select value={type} onValueChange={(val: any) => setType(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Chi tiêu</SelectItem>
                  <SelectItem value="income">Thu nhập</SelectItem>
                  <SelectItem value="transfer">Chuyển khoản</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ngày</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tài khoản / Tài sản</Label>
            <Select value={assetId || undefined} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn tài sản" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name} ({asset.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Số tiền</Label>
            <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
          </div>

          <div className="space-y-2">
            <Label>Danh mục</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="VD: Ăn uống, Lương, Mua sắm" required />
          </div>

          <div className="space-y-2">
            <Label>Ghi chú (Tùy chọn)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nhập ghi chú..." />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={loading}>{loading ? "Đang lưu..." : "Lưu giao dịch"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
