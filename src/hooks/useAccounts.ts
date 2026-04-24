import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../utils/firestoreErrorHandler";
import { sanitizeFirestoreData } from "../lib/utils";

export type AccountType = "bank" | "brokerage" | "fintech" | "ewallet" | "crypto" | "polymarket" | "cash" | "other";

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  createdAt: string;
}

export const useAccounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "accounts"), where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Account[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...(doc.data() as any) } as Account);
        });
        setAccounts(data);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "accounts");
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addAccount = async (account: Omit<Account, "id" | "userId" | "createdAt">) => {
    if (!user) return null;
    try {
      // Check for existing account in Firestore to prevent duplicates from concurrent imports
      const q = query(
        collection(db, "accounts"), 
        where("userId", "==", user.uid),
        where("name", "==", account.name),
        where("type", "==", account.type)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].id;
      }

      const docRef = await addDoc(collection(db, "accounts"), sanitizeFirestoreData({
        ...account,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "accounts");
      return null;
    }
  };

  const updateAccount = async (id: string, updates: Partial<Account>) => {
    if (!user) return;
    try {
      const ref = doc(db, "accounts", id);
      await updateDoc(ref, sanitizeFirestoreData(updates));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `accounts/${id}`);
    }
  };

  const deleteAccount = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "accounts", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `accounts/${id}`);
    }
  };

  const clearAccounts = async () => {
    if (!user) return;
    try {
      const promises = accounts.map(acc => deleteDoc(doc(db, "accounts", acc.id)));
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "accounts/clear");
    }
  };

  return { accounts, loading, addAccount, updateAccount, deleteAccount, clearAccounts };
};
