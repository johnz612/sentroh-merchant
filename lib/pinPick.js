import { create } from "zustand";

/**
 * Hands a pin chosen on the map screen (app/pin-map.jsx) back to the form that opened it.
 * start: where the map opens; picked: { latitude, longitude, place } after "Use this spot".
 */
export const usePinPick = create((set) => ({
  start: null,
  picked: null,
  open(start) { set({ start: start || null, picked: null }); },
  confirm(picked) { set({ picked }); },
  take() {
    let value = null;
    set((st) => { value = st.picked; return { picked: null }; });
    return value;
  },
}));

/** Used when there is no pin and no GPS: Mahayag town center. */
export const DEFAULT_CENTER = { latitude: 8.128011, longitude: 123.437112 };

/** Philippine address parts from the phone's geocoder (Android/iOS, no key, free). */
export function placeToAddress(place) {
  if (!place) return {};
  return {
    street: place.street || place.name || "",
    barangay: place.district || "",
    municipality: place.city || "",
    province: place.subregion || place.region || "",
  };
}
