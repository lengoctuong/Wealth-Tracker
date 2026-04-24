import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Account, AccountType } from "../hooks/useAccounts";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (account: Omit<Account, "id" | "userId" | "createdAt">) => Promise<string | null>;
  onUpdate?: (id: string, updates: Partial<Account>) => Promise<void>;
  editingAccount?: Account | null;
}

export function AddAccountModal({ isOpen, onClose, onAdd, onUpdate, editingAccount }: Props) {
  const [type, setType] = useState<AccountType>("bank");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingAccount) {
        setType(editingAccount.type);
        setName(editingAccount.name);
      } else {
        setType("bank");
        setName("");
      }
    }
  }, [isOpen, editingAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error("Vui lòng nhập tên nguồn tài sản");
      return;
    }

    setLoading(true);
    try {
      if (editingAccount && onUpdate) {
        await onUpdate(editingAccount.id, { type, name });
        toast.success("Cập nhật nguồn tài sản thành công");
      } else {
        await onAdd({ type, name });
        toast.success("Thêm nguồn tài sản thành công");
      }
      onClose();
    } catch (error) {
      toast.error("Lỗi khi xử lý nguồn tài sản");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingAccount ? "Chỉnh Sửa Nguồn Tài Sản" : "Thêm Nguồn Tài Sản Mới"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Loại nguồn</Label>
            <Select value={type} onValueChange={(val: any) => setType(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn loại nguồn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Ngân hàng (VD: Vietcombank)</SelectItem>
                <SelectItem value="brokerage">Chứng khoán (VD: VNDIRECT, SSI)</SelectItem>
                <SelectItem value="fintech">Fintech (VD: Tikop, Finhay)</SelectItem>
                <SelectItem value="ewallet">Ví điện tử (VD: Momo, ZaloPay)</SelectItem>
                <SelectItem value="crypto">Crypto (VD: Binance, OKX)</SelectItem>
                <SelectItem value="polymarket">Polymarket</SelectItem>
                <SelectItem value="cash">Tiền mặt</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tên nguồn (VD: VNDIRECT, Binance, Momo)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên..." required />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={loading}>{loading ? "Đang lưu..." : "Lưu"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
