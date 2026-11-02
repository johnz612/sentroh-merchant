import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Last-seen API data, so screens open instantly with what was shown before
 * and refresh in the background (like Shopee). Kept in memory and saved on
 * the phone for the signed-in person only; cleared on sign-out.
 * Data here is for display; the server re-checks everything on each action.
 */
const STORAGE_KEY = "sentroh_merchant_cache_v1";
const MAX_ENTRIES = 80;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_SAVED_CHARS = 1_500_000; // stay well under Android's per-item storage limit

const entries = new Map(); // key -> { data, at }
let owner = null;
let saveTimer = null;
const inflight = new Map();

/** Restores saved data for this sign-in account (call before showing screens). */
export async function loadCache(ownerId) {
  if (owner === ownerId && entries.size > 0) return;
  entries.clear();
  owner = ownerId;
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) || "null");
    if (saved?.owner !== ownerId || !Array.isArray(saved.entries)) return;
    const now = Date.now();
    for (const [key, entry] of saved.entries) {
      if (entry && now - entry.at < MAX_AGE_MS) entries.set(key, entry);
    }
  } catch {
    // Nothing saved or unreadable: start empty.
  }
}

export async function clearCache() {
  entries.clear();
  inflight.clear();
  owner = null;
  clearTimeout(saveTimer);
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** Cached data for key, or undefined. */
export function cached(key) {
  return key ? entries.get(key)?.data : undefined;
}

/** Milliseconds since key was saved (Infinity when missing). */
export function cachedAge(key) {
  const entry = key ? entries.get(key) : null;
  return entry ? Date.now() - entry.at : Infinity;
}

export function remember(key, data) {
  if (!key || !owner) return;
  entries.delete(key);
  entries.set(key, { data, at: Date.now() });
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
  scheduleSave();
}

/** Changes cached data in place (e.g. after a switch was flipped). */
export function updateCached(key, change) {
  const entry = key ? entries.get(key) : null;
  if (!entry) return;
  try { remember(key, change(entry.data)); } catch { /* keep the old copy */ }
}

/** Removes every key that starts with prefix. */
export function forgetCached(prefix) {
  for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
  scheduleSave();
}

/**
 * Loads into the cache ahead of time (next page, an order's details) unless
 * a copy newer than maxAgeMs exists. Errors are ignored; the screen will retry.
 */
export function prefetch(key, load, { maxAgeMs = 30_000 } = {}) {
  if (!key || !owner || cachedAge(key) < maxAgeMs || inflight.has(key)) return;
  const forOwner = owner;
  const p = Promise.resolve()
    .then(load)
    .then((data) => { if (owner === forOwner) remember(key, data); })
    .catch(() => {})
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 1500);
}

async function save() {
  if (!owner) return;
  try {
    const list = [...entries.entries()];
    let text = JSON.stringify({ owner, entries: list });
    // Too big: drop the oldest until it fits.
    while (text.length > MAX_SAVED_CHARS && list.length > 1) {
      list.splice(0, Math.ceil(list.length / 4));
      text = JSON.stringify({ owner, entries: list });
    }
    await AsyncStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Saving is best effort.
  }
}

/** Cache key for a store API call. */
export function storeKey(storeId, path, query) {
  const q = query ? Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "").sort(([a], [b]) => a.localeCompare(b)) : [];
  return `${storeId}|${path}${q.length ? `?${q.map(([k, v]) => `${k}=${v}`).join("&")}` : ""}`;
}
