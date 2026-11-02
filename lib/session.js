import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { api } from "./api";
import { cached, clearCache, loadCache, remember } from "./cache";
import { supabase } from "./supabase";

const STORE_KEY = "sentroh_merchant_selected_store";
const ROLES_KEY = "me|roles";

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

  /**
   * Opens instantly with the stores saved on this phone, then checks with
   * Sentroh in the background (store list, roles) and updates if anything changed.
   */
  async load() {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      await clearCache();
      return set({ status: "signed-out", stores: [], storeId: null });
    }

    await loadCache(data.session.user.id);
    const saved = cached(ROLES_KEY);
    if (saved) await apply(saved);
    else set({ status: "loading", error: null });

    try {
      const json = await api("/api/v1/me/roles");
      const fresh = { phone: json.phone, roles: json.roles };
      remember(ROLES_KEY, fresh);
      await apply(fresh);
    } catch (err) {
      if (err.status === 401) {
        await clearCache();
        return set({ status: "signed-out", stores: [], storeId: null });
      }
      // With saved stores the app keeps working; screens show their own connection errors.
      if (!saved) set({ status: "error", error: err.message });
    }

    async function apply({ phone, roles }) {
      const stores = (roles?.merchants || []).filter((m) => m.canUseApp);
      if (stores.length === 0) return set({ status: "no-store", phone, stores: [] });

      const current = get().storeId;
      const remembered = current || (await AsyncStorage.getItem(STORE_KEY).catch(() => null));
      const storeId = stores.some((st) => st.merchantId === remembered) ? remembered : stores[0].merchantId;
      set({ status: "ready", phone, stores, storeId, error: null });
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
