import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, description }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="button" variant="destructive" onClick={() => { onConfirm(); onClose(); }}>Xóa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
