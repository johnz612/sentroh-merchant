import { supabase } from "./supabase";

/** Error from the marketplace API, with its stable code. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE = (process.env.EXPO_PUBLIC_MARKETPLACE_API_URL || "").replace(/\/$/, "");

/**
 * Calls the marketplace API as the signed-in person. Returns the JSON body or throws ApiError.
 * When the server says the sign-in has expired (the phone slept, or its clock is off),
 * the sign-in is refreshed once and the call is sent again.
 */
export async function api(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "Your session ended. Sign in again.");
  try {
    return await send(path, options, token);
  } catch (err) {
    if (err.status !== 401) throw err;
    const { data: fresh, error } = await supabase.auth.refreshSession();
    const next = fresh?.session?.access_token;
    if (error || !next) throw new ApiError(401, "UNAUTHORIZED", "Your session ended. Sign in again.");
    return send(path, options, next);
  }
}

async function send(path, { method = "GET", body, query } = {}, token) {
  if (!BASE) throw new ApiError(0, "NO_API_URL", "Set EXPO_PUBLIC_MARKETPLACE_API_URL in .env.");

  const params = Object.entries(query || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

  let res;
  try {
    res = await fetch(`${BASE}${path}${params ? `?${params}` : ""}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "No connection to Sentroh. Check your internet and try again.");
  }

  let json = null;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok || !json?.ok) {
    throw new ApiError(res.status, json?.code || "UNKNOWN", json?.message || `Something went wrong (${res.status}).`, json?.details);
  }
  return json;
}

/** Store routes are all under /api/v1/merchant/:merchantId. */
export const storeApi = (merchantId) => (path, options) => api(`/api/v1/merchant/${merchantId}${path}`, options);
