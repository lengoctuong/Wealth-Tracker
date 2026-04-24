import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../utils/firestoreErrorHandler";
import { sanitizeFirestoreData } from "../lib/utils";

export interface Transaction {
  id: string;
  userId: string;
  assetId: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  description?: string;
  date: string;
  createdAt: string;
}

export interface InvestmentTransaction {
  id: string;
  userId: string;
  assetId: string;
  type: "buy" | "sell";
  quantity: number;
  remainingQty: number; // For FIFO tracking
  price: number;
  purchasePrice?: number; // For sell transactions, the matched purchase price (FIFO)
  date: string; // YYYY-MM-DD
  isClosed: boolean; // True if remainingQty is 0
  createdAt: string;
}

export const useTransactions = (assetId?: string) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("date", "desc")
    );

    if (assetId) {
      q = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        where("assetId", "==", assetId),
        orderBy("date", "desc")
      );
    }
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const transactionsData: Transaction[] = [];
        snapshot.forEach((doc) => {
          transactionsData.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        setTransactions(transactionsData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "transactions");
      }
    );

    return () => unsubscribe();
  }, [user, assetId]);

  const addTransaction = async (transaction: Omit<Transaction, "id" | "userId" | "createdAt">) => {
    if (!user) return null;
    try {
      const data = {
        ...transaction,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "transactions"), sanitizeFirestoreData(data));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "transactions");
      return null;
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "transactions", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  return { transactions, loading, addTransaction, deleteTransaction };
};

export const useInvestmentTransactions = (assetId?: string) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, "investment_transactions"),
      where("userId", "==", user.uid),
      orderBy("date", "desc")
    );

    if (assetId) {
      q = query(
        collection(db, "investment_transactions"),
        where("userId", "==", user.uid),
        where("assetId", "==", assetId),
        orderBy("date", "desc")
      );
    }
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const transactionsData: InvestmentTransaction[] = [];
        snapshot.forEach((doc) => {
          transactionsData.push({ id: doc.id, ...doc.data() } as InvestmentTransaction);
        });
        setTransactions(transactionsData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "investment_transactions");
      }
    );

    return () => unsubscribe();
  }, [user, assetId]);

  const addInvestmentTransaction = async (transaction: Omit<InvestmentTransaction, "id" | "userId" | "createdAt" | "remainingQty" | "isClosed">) => {
    if (!user) return null;
    try {
      const data: any = {
        ...transaction,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        remainingQty: transaction.type === "buy" ? transaction.quantity : 0,
        isClosed: transaction.type === "sell" // Sell transactions are closed by default as they don't have remaining qty to sell
      };

      // If it's a sell transaction, we need to close/update previous buy transactions (FIFO)
      if (transaction.type === "sell") {
        let qtyToSell = transaction.quantity;
        let totalPurchaseCost = 0;
        
        // Get all open buy transactions for this asset, ordered by date (FIFO)
        const q = query(
          collection(db, "investment_transactions"),
          where("userId", "==", user.uid),
          where("assetId", "==", transaction.assetId),
          where("type", "==", "buy"),
          where("isClosed", "==", false),
          orderBy("date", "asc")
        );
        
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);

        for (const docSnap of querySnapshot.docs) {
          if (qtyToSell <= 0) break;
          
          const buyTx = docSnap.data() as InvestmentTransaction;
          const availableQty = buyTx.remainingQty;
          
          if (availableQty <= qtyToSell) {
            // This buy transaction is fully consumed
            batch.update(docSnap.ref, {
              remainingQty: 0,
              isClosed: true
            });
            totalPurchaseCost += availableQty * buyTx.price;
            qtyToSell -= availableQty;
          } else {
            // This buy transaction is partially consumed
            batch.update(docSnap.ref, {
              remainingQty: availableQty - qtyToSell,
              isClosed: false
            });
            totalPurchaseCost += qtyToSell * buyTx.price;
            qtyToSell = 0;
          }
        }
        
        await batch.commit();
        
        // Store the average purchase price for this sell transaction
        if (totalPurchaseCost > 0) {
          data.purchasePrice = totalPurchaseCost / (transaction.quantity - qtyToSell);
        }
      }

      const docRef = await addDoc(collection(db, "investment_transactions"), sanitizeFirestoreData(data));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "investment_transactions");
      return null;
    }
  };

  const deleteInvestmentTransaction = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "investment_transactions", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `investment_transactions/${id}`);
    }
  };

  const clearInvestmentTransactions = async () => {
    if (!user) return;
    try {
      const batch = transactions.map(tx => deleteDoc(doc(db, "investment_transactions", tx.id)));
      await Promise.all(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "investment_transactions");
    }
  };

  const rebuildFIFOLayers = async () => {
    if (!user) return;
    try {
      // 1. Get all transactions for all assets, ordered by date
      const q = query(
        collection(db, "investment_transactions"),
        where("userId", "==", user.uid),
        orderBy("date", "asc"),
        orderBy("createdAt", "asc")
      );
      const snapshot = await getDocs(q);
      const allTxs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvestmentTransaction));
      
      // 2. Group by asset
      const assetGroups: Record<string, InvestmentTransaction[]> = {};
      allTxs.forEach(tx => {
        if (!assetGroups[tx.assetId]) assetGroups[tx.assetId] = [];
        assetGroups[tx.assetId].push(tx);
      });
      
      const batch = writeBatch(db);
      
      // 3. Re-calculate FIFO for each asset
      for (const assetId in assetGroups) {
        const txs = assetGroups[assetId];
        const openBuys: InvestmentTransaction[] = [];
        
        for (const tx of txs) {
          const txRef = doc(db, "investment_transactions", tx.id);
          
          if (tx.type === 'buy') {
            // Reset buy transaction
            tx.remainingQty = tx.quantity;
            tx.isClosed = false;
            openBuys.push(tx);
            batch.update(txRef, { remainingQty: tx.quantity, isClosed: false });
          } else {
            // Process sell transaction
            let qtyToSell = tx.quantity;
            let totalPurchaseCost = 0;
            
            for (const buyTx of openBuys) {
              if (qtyToSell <= 0) break;
              if (buyTx.isClosed) continue;
              
              const availableQty = buyTx.remainingQty;
              const buyRef = doc(db, "investment_transactions", buyTx.id);
              
              if (availableQty <= qtyToSell) {
                totalPurchaseCost += availableQty * buyTx.price;
                qtyToSell -= availableQty;
                buyTx.remainingQty = 0;
                buyTx.isClosed = true;
                batch.update(buyRef, { remainingQty: 0, isClosed: true });
              } else {
                totalPurchaseCost += qtyToSell * buyTx.price;
                buyTx.remainingQty -= qtyToSell;
                qtyToSell = 0;
                batch.update(buyRef, { remainingQty: buyTx.remainingQty, isClosed: false });
              }
            }
            
            const purchasePrice = tx.quantity > 0 ? totalPurchaseCost / (tx.quantity - qtyToSell) : 0;
            batch.update(txRef, { purchasePrice, isClosed: true, remainingQty: 0 });
          }
        }
      }
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "investment_transactions/rebuild");
    }
  };

  return { transactions, loading, addInvestmentTransaction, deleteInvestmentTransaction, clearInvestmentTransactions, rebuildFIFOLayers };
};
