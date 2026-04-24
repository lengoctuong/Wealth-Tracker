import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export const DEFAULT_BACKEND_URL = "https://d352-14-161-20-81.ngrok-free.app";

export const configService = {
  async getBackendUrl(userId: string): Promise<string> {
    try {
      const configDoc = await getDoc(doc(db, "settings", userId));
      if (configDoc.exists()) {
        return configDoc.data().backendUrl || DEFAULT_BACKEND_URL;
      }
      return DEFAULT_BACKEND_URL;
    } catch (error) {
      console.error("Error fetching backend URL:", error);
      return DEFAULT_BACKEND_URL;
    }
  },

  async setBackendUrl(userId: string, url: string): Promise<void> {
    try {
      await setDoc(doc(db, "settings", userId), { backendUrl: url }, { merge: true });
    } catch (error) {
      console.error("Error saving backend URL:", error);
      throw error;
    }
  }
};
