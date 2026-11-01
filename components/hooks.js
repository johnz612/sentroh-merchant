import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { storeApi } from "@/lib/api";
import { useSession } from "@/lib/session";

/** The selected store's API caller and info. */
export function useStore() {
  const storeId = useSession((st) => st.storeId);
  const stores = useSession((st) => st.stores);
  const store = stores.find((x) => x.merchantId === storeId) || null;
  return { storeId, store, call: storeApi(storeId), canEdit: store ? ["OWNER", "MANAGER"].includes(store.role) : false };
}

/**
 * Loads data when the screen is focused, optionally every `intervalMs` while
 * focused. `load` must return a promise.
 */
export function useLoader(load, deps, { intervalMs } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    setState((st) => ({ ...st, loading: true, error: null }));
    try {
      const data = await loadRef.current();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((st) => ({ data: st.data, error, loading: false }));
    }
  }, []);

  useEffect(() => { reload(); }, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      if (!intervalMs) return undefined;
      const timer = setInterval(reload, intervalMs);
      return () => clearInterval(timer);
    }, [reload, intervalMs]),
  );

  return { ...state, reload };
}
