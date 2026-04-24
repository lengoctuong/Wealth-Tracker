import React from "react";
import { Transaction } from "../hooks/useTransactions";
import { Asset } from "../hooks/useAssets";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Trash2, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface Props {
  transactions: Transaction[];
  assets: Asset[];
  loading: boolean;
  onDelete: (id: string) => void;
}

export function TransactionList({ transactions, assets, loading, onDelete }: Props) {
  if (loading) {
    return <div className="text-center py-4 text-gray-500">Đang tải...</div>;
  }

  if (transactions.length === 0) {
    return <div className="text-center py-8 text-gray-500">Chưa có giao dịch nào.</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const getAssetInfo = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset ? asset.name : "Không xác định";
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ngày</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead>Tài sản</TableHead>
            <TableHead>Danh mục</TableHead>
            <TableHead>Ghi chú</TableHead>
            <TableHead className="text-right">Số tiền</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const isIncome = tx.type === 'income';
            const isExpense = tx.type === 'expense';
            const isTransfer = tx.type === 'transfer';

            return (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(tx.date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>
                  <div className={`flex items-center gap-1 text-sm font-medium ${isIncome ? 'text-green-600' : isExpense ? 'text-red-600' : 'text-blue-600'}`}>
                    {isIncome && <ArrowUpRight className="w-4 h-4" />}
                    {isExpense && <ArrowDownRight className="w-4 h-4" />}
                    {isTransfer && <RefreshCw className="w-4 h-4" />}
                    {isIncome ? "Thu nhập" : isExpense ? "Chi tiêu" : "Chuyển khoản"}
                  </div>
                </TableCell>
                <TableCell>{getAssetInfo(tx.assetId)}</TableCell>
                <TableCell>{tx.category}</TableCell>
                <TableCell className="max-w-[200px] truncate text-gray-500" title={tx.description}>
                  {tx.description || "-"}
                </TableCell>
                <TableCell className={`text-right font-semibold ${isIncome ? 'text-green-600' : isExpense ? 'text-red-600' : 'text-gray-900'}`}>
                  {isExpense ? "-" : isIncome ? "+" : ""}{formatCurrency(tx.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => onDelete(tx.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
