const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });

export const money = (v) => (v == null ? "—" : peso.format(Number(v)));

/** Time in the Philippines, like "9:50 PM" (with the day when not today). */
export function clock(value) {
  if (!value) return "";
  const d = new Date(value);
  const opts = { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" };
  const sameDay = new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila" }) === d.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });
  return sameDay ? d.toLocaleTimeString("en-PH", opts) : d.toLocaleString("en-PH", { ...opts, weekday: "short", month: "short", day: "numeric" });
}

export function minutesLeft(value) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 60000));
}

export function ago(value) {
  if (!value) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

export const qty = (q, unit) => (unit === "KG" ? `${Number(q)} kg` : `${Number(q)}×`);

export const STATUS_TEXT = {
  PENDING: "New",
  CONFIRMED: "Preparing",
  PREPARING: "Preparing",
  STOCK_ISSUE: "Waiting for customer",
  READY_FOR_PICKUP: "Ready",
  OUT_FOR_DELIVERY: "With driver",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const WHY_HIDDEN = {
  HIDDEN_BY_SENTROH: "Hidden by Sentroh",
  OFF: "Off",
  MARKED_UNAVAILABLE: "Marked unavailable",
  INACTIVE_IN_POS: "Inactive in POS",
  OFFLINE_IN_POS: "Not for online sale in POS",
  OUT_OF_STOCK: "Out of stock",
};
