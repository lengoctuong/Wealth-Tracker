import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../utils/firestoreErrorHandler";
import { sanitizeFirestoreData } from "../lib/utils";
import { InvestmentTransaction } from "./useTransactions";

export interface Asset {
  id: string;
  userId: string;
  accountId: string;
  category: string; // stock, etf, cash, coin, usdt, saving, fund, etc.
  name: string;
  symbol?: string;
  quantity?: number;
  purchasePrice?: number;
  purchaseDate?: string;
  currentPrice?: number;
  balance?: number;
  interestRate?: number;
  currency: string;
  updatedAt: string;
  isFinished?: boolean;
}

export const useAssets = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>([]);

  // Listen to assets
  useEffect(() => {
    if (!user) {
      setAssets([]);
      return;
    }

    const q = query(collection(db, "assets"), where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const assetsData: Asset[] = [];
        snapshot.forEach((doc) => {
          assetsData.push({ id: doc.id, ...(doc.data() as any) } as Asset);
        });
        setAssets(assetsData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "assets");
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Listen to open investment transactions
  useEffect(() => {
    if (!user) {
      setInvestmentTransactions([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "investment_transactions"), 
      where("userId", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txData: InvestmentTransaction[] = [];
        snapshot.forEach((doc) => {
          txData.push({ id: doc.id, ...(doc.data() as any) } as InvestmentTransaction);
        });
        setInvestmentTransactions(txData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "investment_transactions");
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Merge assets with calculated investment holdings
  const mergedAssets = useMemo(() => {
    return assets.map(asset => {
      // If it's an investment asset, calculate quantity and purchasePrice from transactions
      if (["stock", "etf", "coin", "fund", "crypto"].includes(asset.category)) {
        const assetTxs = investmentTransactions.filter(tx => tx.assetId === asset.id);
        
        let totalQuantity = 0;
        let avgPurchasePrice = 0;

        if (["stock", "etf"].includes(asset.category)) {
          // MA Logic (VNDIRECT style for Brokerage tab only)
          // Sort chronologically ascending
          const sortedTxs = [...assetTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          let maPrice = 0;
          let currentQty = 0;
          
          for (const tx of sortedTxs) {
            if (tx.type === "buy") {
              const newQty = currentQty + tx.quantity;
              if (newQty > 0) {
                maPrice = ((maPrice * currentQty) + (tx.price * tx.quantity)) / newQty;
                currentQty = newQty;
              }
            } else if (tx.type === "sell") {
              currentQty -= tx.quantity;
              if (currentQty <= 0) {
                currentQty = 0;
                maPrice = 0; // Reset if sold out completely
              }
            }
          }
          totalQuantity = currentQty;
          avgPurchasePrice = maPrice;

        } else {
          // FIFO Logic for Crypto/Coin
          totalQuantity = assetTxs.reduce((sum, tx) => sum + tx.remainingQty, 0);
          const totalCost = assetTxs.reduce((sum, tx) => sum + (tx.remainingQty * tx.price), 0);
          avgPurchasePrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
        }
        
        return {
          ...asset,
          quantity: totalQuantity,
          purchasePrice: avgPurchasePrice,
          balance: totalQuantity * (asset.currentPrice || avgPurchasePrice),
          isFinished: totalQuantity <= 0
        };
      }
      // For other assets, return as is (they store balance directly)
      return asset;
    });
  }, [assets, investmentTransactions]);

  const addAsset = async (asset: Omit<Asset, "id" | "userId" | "updatedAt">) => {
    if (!user) return null;
    try {
      let existingAsset: Asset | undefined = undefined;
      
      if (asset.symbol || asset.name) {
        let q;
        if (asset.symbol) {
          q = query(
            collection(db, "assets"),
            where("userId", "==", user.uid),
            where("accountId", "==", asset.accountId),
            where("category", "==", asset.category),
            where("symbol", "==", asset.symbol)
          );
        } else {
          q = query(
            collection(db, "assets"),
            where("userId", "==", user.uid),
            where("accountId", "==", asset.accountId),
            where("category", "==", asset.category),
            where("name", "==", asset.name)
          );
        }
        
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data() as any;
          existingAsset = { id: snapshot.docs[0].id, ...docData } as Asset;
        }
      }

      if (existingAsset) {
        // If it's an investment asset, we don't update quantity/purchasePrice here anymore
        // as they are derived from transactions. We might update currentPrice though.
        if (["stock", "etf", "coin", "fund", "crypto"].includes(asset.category)) {
          const updates: any = {
            updatedAt: new Date().toISOString(),
          };
          if (asset.currentPrice !== undefined) {
            updates.currentPrice = asset.currentPrice;
          }
          if (asset.name !== undefined) {
            updates.name = asset.name;
          }
          const assetRef = doc(db, "assets", existingAsset.id);
          await updateDoc(assetRef, sanitizeFirestoreData(updates));
          return existingAsset.id;
        }

        // For other assets (cash, saving, etc.), we update the balance
        const updates: any = {
          updatedAt: new Date().toISOString(),
        };

        if (asset.balance !== undefined) {
          updates.balance = asset.balance;
        }
        if (asset.interestRate !== undefined) {
          updates.interestRate = asset.interestRate;
        }
        if (asset.name !== undefined) {
          updates.name = asset.name;
        }

        const assetRef = doc(db, "assets", existingAsset.id);
        await updateDoc(assetRef, sanitizeFirestoreData(updates));
        return existingAsset.id;
      } else {
        const data: any = {
          ...asset,
          userId: user.uid,
          updatedAt: new Date().toISOString(),
        };

        // For investment assets, we don't need to store quantity/purchasePrice in the doc
        if (["stock", "etf", "coin", "fund", "crypto"].includes(asset.category)) {
          delete data.quantity;
          delete data.purchasePrice;
          delete data.balance;
        }

        const docRef = await addDoc(collection(db, "assets"), sanitizeFirestoreData(data));
        return docRef.id;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "assets");
      return null;
    }
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    if (!user) return;
    try {
      const assetRef = doc(db, "assets", id);
      
      await updateDoc(assetRef, sanitizeFirestoreData({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `assets/${id}`);
    }
  };

  const deleteAsset = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "assets", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `assets/${id}`);
    }
  };

  const clearAssets = async () => {
    if (!user) return;
    try {
      const promises = assets.map(asset => deleteDoc(doc(db, "assets", asset.id)));
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "assets/clear");
    }
  };

  return { assets: mergedAssets, loading, addAsset, updateAsset, deleteAsset, clearAssets };
};
