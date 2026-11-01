import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { api } from "./api";
import { supabase } from "./supabase";

const STORE_KEY = "sentroh_merchant_selected_store";

/**
 * Sign-in state and the selected store.
 * status: loading | signed-out | no-store | ready | error
 */
export const useSession = create((set, get) => ({
  status: "loading",
  phone: null,
  stores: [],
  storeId: null,
  error: null,

  async load() {
    set({ status: "loading", error: null });
    const { data } = await supabase.auth.getSession();
    if (!data?.session) return set({ status: "signed-out", stores: [], storeId: null });

    try {
      const json = await api("/api/v1/me/roles");
      const stores = (json.roles?.merchants || []).filter((m) => m.canUseApp);
      if (stores.length === 0) return set({ status: "no-store", phone: json.phone, stores: [] });

      const saved = await AsyncStorage.getItem(STORE_KEY).catch(() => null);
      const storeId = stores.some((s) => s.merchantId === saved) ? saved : stores[0].merchantId;
      set({ status: "ready", phone: json.phone, stores, storeId });
    } catch (err) {
      if (err.status === 401) return set({ status: "signed-out" });
      set({ status: "error", error: err.message });
    }
  },

  async selectStore(storeId) {
    await AsyncStorage.setItem(STORE_KEY, storeId).catch(() => {});
    set({ storeId });
  },

  store() {
    const { stores, storeId } = get();
    return stores.find((s) => s.merchantId === storeId) || null;
  },
}));
