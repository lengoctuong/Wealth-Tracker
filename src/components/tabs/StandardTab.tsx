import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Trash2, Wallet, Landmark, Home, MoreHorizontal, Edit2, Coins, Target } from "lucide-react";
import { Account, AccountType } from "../../hooks/useAccounts";
import { Asset } from "../../hooks/useAssets";
import { Transaction } from "../../hooks/useTransactions";
import { ConfirmModal } from "../ConfirmModal";
import { formatCurrency, getAssetValue, getCategoryLabel } from "../../lib/utils";

interface Props {
  type: AccountType | 'other';
  title: string;
  accounts: Account[];
  assets: Asset[];
  transactions: Transaction[];
  usdtRate?: number;
  showValues?: boolean;
  onDeleteAsset: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onEditAsset: (asset: Asset) => void;
  onEditAccount: (account: Account) => void;
}

export function StandardTab({ 
  type, 
  title, 
  accounts, 
  assets, 
  transactions,
  usdtRate = 25500,
  showValues = true,
  onDeleteAsset, 
  onDeleteAccount,
  onEditAsset,
  onEditAccount
}: Props) {
  const [deleteAccountInfo, setDeleteAccountInfo] = useState<{id: string, name: string} | null>(null);
  const [deleteAssetInfo, setDeleteAssetInfo] = useState<{id: string, name: string} | null>(null);

  const filteredAccounts = type === 'other' 
    ? accounts.filter(a => !['brokerage', 'crypto', 'fintech', 'ewallet', 'bank', 'polymarket'].includes(a.type))
    : accounts.filter(a => a.type === type);

  const getAssetIcon = (category: string) => {
    switch (category) {
      case 'cash': return <Wallet className="w-4 h-4" />;
      case 'deposit': return <Landmark className="w-4 h-4" />;
      case 'saving': return <Landmark className="w-4 h-4" />;
      case 'payment': return <Wallet className="w-4 h-4" />;
      case 'usdt': return <Coins className="w-4 h-4" />;
      case 'usdc': return <Coins className="w-4 h-4" />;
      case 'position': return <Target className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  if (filteredAccounts.length === 0) {
    return <div className="text-center py-8 text-gray-500">Chưa có {title.toLowerCase()} nào. Hãy thêm mới!</div>;
  }

  return (
    <div className="space-y-6">
      {filteredAccounts.map(account => {
        const accountAssets = assets.filter(a => a.accountId === account.id);
        const totalValue = accountAssets.reduce((sum, asset) => sum + getAssetValue(asset, usdtRate), 0);
        
        return (
          <Card key={account.id} className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-100 flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-800">{account.name}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Tổng: <span className="font-semibold text-primary">{showValues ? formatCurrency(totalValue, 'VND') : "****"}</span></p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => onEditAccount(account)}>
                  <Edit2 className="w-4 h-4 mr-2" /> Sửa
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteAccountInfo({ id: account.id, name: account.name })}>
                  <Trash2 className="w-4 h-4 mr-2" /> Xóa nguồn
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên khoản mục</TableHead>
                      <TableHead>Phân loại</TableHead>
                      <TableHead className="text-right">Lãi suất</TableHead>
                      <TableHead className="text-right">Thay đổi</TableHead>
                      <TableHead className="text-right">Số dư</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-4">Chưa có khoản mục nào</TableCell>
                      </TableRow>
                    ) : (
                      accountAssets.map(asset => {
                        return (
                          <TableRow key={asset.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                                  {getAssetIcon(asset.category)}
                                </div>
                                <div>
                                  <p className="text-sm">{asset.name}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-gray-50 text-xs">{getCategoryLabel(asset.category, type)}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium text-gray-600">
                              {asset.category === 'cash' ? '0%' : (asset.interestRate ? `${asset.interestRate}%` : '-')}
                            </TableCell>
                            <TableCell className="text-right">
                              {(() => {
                                const initial = asset.purchasePrice || 0;
                                const current = asset.balance || 0;
                                const profit = current - initial;
                                if (initial === 0 && current === 0) return <span className="text-gray-400">-</span>;
                                return (
                                  <span className={`text-xs font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {profit >= 0 ? "+" : ""}{showValues ? formatCurrency(profit, asset.currency) : "****"}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary text-sm">
                              <div className="flex flex-col items-end">
                                <span>{showValues ? formatCurrency(getAssetValue(asset, 1), asset.currency) : "****"}</span>
                                {asset.currency !== 'VND' && showValues && (
                                  <span className="text-[10px] text-gray-400">
                                    ≈ {formatCurrency(getAssetValue(asset, usdtRate), 'VND')}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => onEditAsset(asset)} className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteAssetInfo({ id: asset.id, name: asset.name })} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Debug Section: Transaction History */}
      <details className="mt-12 group border-t border-slate-200 pt-6">
        <summary className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-600 transition-colors list-none">
          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full group-open:bg-blue-500 group-open:animate-pulse"></div>
          CÔNG CỤ DEBUG: LỊCH SỬ TOÀN BỘ GIAO DỊCH ({title})
          <span className="text-[10px] font-normal opacity-60 group-open:hidden">(Click để xem chi tiết)</span>
        </summary>
        
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-200">
                <TableHead className="text-[10px] uppercase text-slate-500">Ngày</TableHead>
                <TableHead className="text-[10px] uppercase text-slate-500">Tài sản</TableHead>
                <TableHead className="text-[10px] uppercase text-slate-500">Loại</TableHead>
                <TableHead className="text-[10px] uppercase text-slate-500">Danh mục</TableHead>
                <TableHead className="text-[10px] uppercase text-slate-500 text-right">Số tiền</TableHead>
                <TableHead className="text-[10px] uppercase text-slate-500">Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const accountIds = filteredAccounts.map(a => a.id);
                const relevantAssets = assets.filter(a => accountIds.includes(a.accountId));
                const relevantAssetIds = relevantAssets.map(a => a.id);
                const relevantTxs = transactions
                  .filter(tx => relevantAssetIds.includes(tx.assetId))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (relevantTxs.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-slate-400 text-xs italic">Không có giao dịch nào</TableCell>
                    </TableRow>
                  );
                }

                return relevantTxs.map(tx => {
                  const asset = assets.find(a => a.id === tx.assetId);
                  return (
                    <TableRow key={tx.id} className="border-slate-100 hover:bg-slate-100/50">
                      <TableCell className="text-[11px] font-mono text-slate-600">{tx.date}</TableCell>
                      <TableCell className="text-[11px] font-bold text-slate-700">{asset?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] uppercase px-1 py-0 h-4 ${tx.type === 'income' ? 'bg-green-50 text-green-600 border-green-200' : tx.type === 'expense' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                          {tx.type === 'income' ? 'THU' : tx.type === 'expense' ? 'CHI' : 'CHUYỂN'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600">{tx.category}</TableCell>
                      <TableCell className="text-[11px] text-right font-mono font-bold">
                        {tx.amount.toLocaleString()} {asset?.currency}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-500 italic max-w-[200px] truncate">{tx.description || '-'}</TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </div>
      </details>

      <ConfirmModal
        isOpen={!!deleteAccountInfo}
        onClose={() => setDeleteAccountInfo(null)}
        onConfirm={() => deleteAccountInfo && onDeleteAccount(deleteAccountInfo.id)}
        title="Xóa nguồn tài sản"
        description={`Bạn có chắc chắn muốn xóa nguồn "${deleteAccountInfo?.name}"? Tất cả tài sản trong nguồn này cũng sẽ bị xóa.`}
      />

      <ConfirmModal
        isOpen={!!deleteAssetInfo}
        onClose={() => setDeleteAssetInfo(null)}
        onConfirm={() => deleteAssetInfo && onDeleteAsset(deleteAssetInfo.id)}
        title="Xóa tài sản"
        description={`Bạn có chắc chắn muốn xóa tài sản "${deleteAssetInfo?.name}"?`}
      />
    </div>
  );
}
