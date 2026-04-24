import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Download, Upload, Trash2, AlertTriangle, X, FileJson, Link } from "lucide-react";
import { toast } from "sonner";
import { marketService } from "../services/marketService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onExportInvestment: () => void;
  onExportOtherAssets: () => void;
  onBulkImport: () => void;
  onImportOtherAssets: () => void;
  onClearAll: () => Promise<void>;
  onUpdateBackendUrl: (url: string) => Promise<void>;
}

export function SettingsModal({ 
  isOpen, 
  onClose, 
  onExportInvestment,
  onExportOtherAssets,
  onBulkImport, 
  onImportOtherAssets, 
  onClearAll, 
  onUpdateBackendUrl
}: Props) {
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [backendUrl, setBackendUrl] = useState("");

  useEffect(() => {
    if (isOpen) {
      setBackendUrl(marketService.getBackendUrl());
    }
  }, [isOpen]);

  const handleClearData = async () => {
    await onClearAll();
    setShowConfirmClear(false);
    onClose();
  };

  const handleSaveBackendUrl = async () => {
    try {
      await onUpdateBackendUrl(backendUrl);
      toast.success("Đã cập nhật URL Backend thành công");
    } catch (error) {
      toast.error("Lỗi khi cập nhật URL Backend");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setShowConfirmClear(false);
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {showConfirmClear ? "Xác nhận xóa dữ liệu" : "Cài đặt hệ thống"}
          </DialogTitle>
        </DialogHeader>
        
        {showConfirmClear ? (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-lg text-red-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="text-sm font-medium">
                Hành động này sẽ xóa vĩnh viễn TOÀN BỘ nguồn tài sản, tài sản và lịch sử giao dịch của bạn. Bạn có chắc chắn muốn tiếp tục?
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="destructive" className="w-full" onClick={handleClearData}>
                Tôi hiểu, hãy xóa toàn bộ dữ liệu
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowConfirmClear(false)}>
                Hủy bỏ
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Cấu hình API</h3>
              <div className="space-y-2">
                <Label htmlFor="backend-url" className="text-xs">Python Backend URL (ngrok)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input 
                      id="backend-url"
                      value={backendUrl}
                      onChange={(e) => setBackendUrl(e.target.value)}
                      placeholder="https://your-ngrok-url.ngrok-free.app"
                      className="pl-9 text-xs"
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveBackendUrl}>Lưu</Button>
                </div>
                <p className="text-[10px] text-gray-400">URL này cung cấp dữ liệu giá chứng khoán, crypto và VN-Index.</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Sao lưu & Khôi phục</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="w-full gap-2 text-xs" onClick={onExportInvestment}>
                  <Download className="w-4 h-4" />
                  Xuất ĐT
                </Button>
                <Button variant="outline" className="w-full gap-2 text-xs" onClick={onExportOtherAssets}>
                  <Download className="w-4 h-4" />
                  Xuất TS
                </Button>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={() => { onClose(); onBulkImport(); }}>
                <FileJson className="w-4 h-4" />
                Nhập giao dịch đầu tư
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => { onClose(); onImportOtherAssets(); }}>
                <FileJson className="w-4 h-4" />
                Nhập tài sản khác
              </Button>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-red-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Vùng nguy hiểm
              </h3>
              <div className="space-y-2">
                <Button 
                  variant="destructive" 
                  className="w-full justify-start gap-3 bg-red-50 text-red-600 hover:bg-red-100 border-red-100" 
                  onClick={() => setShowConfirmClear(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa toàn bộ dữ liệu
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Hành động này không thể hoàn tác. Dữ liệu sẽ bị xóa vĩnh viễn.
              </p>
            </div>
          </div>
        )}

        {!showConfirmClear && (
          <DialogFooter>
            <Button onClick={onClose}>Đóng</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

