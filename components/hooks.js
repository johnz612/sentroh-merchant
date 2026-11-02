import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { storeApi } from "@/lib/api";
import { cached, cachedAge, remember, storeKey } from "@/lib/cache";
import { useSession } from "@/lib/session";

/** The selected store's API caller and info. */
export function useStore() {
  const storeId = useSession((st) => st.storeId);
  const stores = useSession((st) => st.stores);
  const store = stores.find((x) => x.merchantId === storeId) || null;
  return {
    storeId, store, call: storeApi(storeId), canEdit: store ? ["OWNER", "MANAGER"].includes(store.role) : false,
    /** Cache key for one of this store's API calls (see useLoader's key). */
    keyFor: (path, query) => storeKey(storeId, path, query),
  };
}

/**
 * Loads data for a screen. With `key`, the last copy shows at once (from the
 * phone's cache) while fresh data loads in the background, so screens open
 * without a spinner after the first time. Reloads when deps change, every
 * `intervalMs` while focused, and on coming back to the screen when the data
 * is older than `refreshOnFocusMs`. `load` must return a promise.
 * Returns { data, error, loading, refreshing, reload, refresh }; `refreshing`
 * is only true for a pull-to-refresh (refresh()), not for background reloads.
 */
export function useLoader(load, deps, { intervalMs, key, refreshOnFocusMs = 15000 } = {}) {
  const [state, setState] = useState(() => ({ key, data: key ? cached(key) ?? null : null, error: null, loading: true, refreshing: false }));
  const loadRef = useRef(load);
  loadRef.current = load;
  const keyRef = useRef(key);
  keyRef.current = key;
  const lastLoad = useRef(0);

  const run = useCallback(async (byUser) => {
    const forKey = keyRef.current;
    setState((st) => ({
      ...(st.key === forKey ? st : { key: forKey, data: forKey ? cached(forKey) ?? null : null }),
      loading: true, refreshing: !!byUser, error: null,
    }));
    try {
      const data = await loadRef.current();
      if (forKey) remember(forKey, data);
      lastLoad.current = Date.now();
      if (keyRef.current !== forKey) return; // the screen moved on (other filter or store)
      setState({ key: forKey, data, error: null, loading: false, refreshing: false });
    } catch (error) {
      if (keyRef.current !== forKey) return;
      setState((st) => ({ ...st, error, loading: false, refreshing: false }));
    }
  }, []);

  const reload = useCallback(() => run(false), [run]);
  const refresh = useCallback(() => run(true), [run]);

  useEffect(() => { reload(); }, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      // Back on the screen: refresh if the data is old, or if a change elsewhere dropped its copy.
      const dropped = keyRef.current && cachedAge(keyRef.current) === Infinity;
      if (lastLoad.current && (dropped || Date.now() - lastLoad.current > refreshOnFocusMs)) reload();
      if (!intervalMs) return undefined;
      const timer = setInterval(reload, intervalMs);
      return () => clearInterval(timer);
    }, [reload, intervalMs, refreshOnFocusMs]),
  );

  // Before the first answer for a new key arrives, show that key's cached copy.
  const current = state.key === key ? state : { ...state, data: key ? cached(key) ?? null : null, loading: true, refreshing: false };
  return { data: current.data, error: current.error, loading: current.loading, refreshing: current.refreshing, reload, refresh };
}
