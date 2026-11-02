import { storeApi } from "./api";
import { prefetch, storeKey } from "./cache";

/**
 * Loads each tab's first screen in the background as soon as a store is open
 * (like Lazada's account page), so the first tap on any tab shows data at once.
 * Keys must match the ones the screens use. Errors are ignored; screens retry.
 */
export function warmUpStore(storeId, { canEdit }) {
  if (!storeId) return;
  const call = storeApi(storeId);
  const ahead = (path, query) => prefetch(storeKey(storeId, path, query), () => call(path, query ? { query } : undefined));

  ahead("/orders", { filter: "NEW", limit: 50 });
  ahead("/store");
  ahead("/products", { view: "ALL", search: "", page: 1, limit: 40 });
  if (canEdit) {
    ahead("/earnings", { period: "TODAY" });
    ahead("/categories");
  }
}
