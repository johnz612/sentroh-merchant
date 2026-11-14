import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "react-native";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Button, Card, Field, FieldTag, Notice, s, Screen, Skeleton } from "@/components/ui";
import { forgetCached } from "@/lib/cache";
import { usePinPick } from "@/lib/pinPick";
import { C } from "@/lib/theme";
import { toast } from "@/lib/toast";

/**
 * Store tab > Location: change the store's address and map pin after sign-up.
 * Owner only (the pin decides delivery distance and fees; the server checks too).
 * Sentroh admins are told when the pin moves.
 */
export default function StoreLocation() {
  const router = useRouter();
  const { storeId, call, keyFor } = useStore();
  const { data, error } = useLoader(() => call("/store"), [storeId], { key: keyFor("/store") });
  const filled = useRef(false);
  const [f, setF] = useState({ addressLine1: "", addressLine2: "", barangay: "", municipality: "", province: "" });
  const [pin, setPin] = useState(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [failure, setFailure] = useState(null);
  const set = (key) => (v) => { setF((cur) => ({ ...cur, [key]: v })); setChanged(true); };

  // Fill the form once from the saved store details; later refreshes never overwrite typing.
  useEffect(() => {
    const loc = data?.branch?.location;
    if (!loc || filled.current) return;
    filled.current = true;
    setF({ addressLine1: loc.addressLine1, addressLine2: loc.addressLine2, barangay: loc.barangay, municipality: loc.municipality, province: loc.province });
    if (loc.latitude != null) setPin({ latitude: loc.latitude, longitude: loc.longitude, saved: true });
  }, [data]);

  // Back from the map: use the chosen spot; fill only empty address fields from it.
  useFocusEffect(useCallback(() => {
    const picked = usePinPick.getState().take();
    if (!picked) return;
    setPin({ latitude: picked.latitude, longitude: picked.longitude, onMap: true });
    setChanged(true);
    const p = picked.place || {};
    setF((cur) => ({
      ...cur,
      addressLine1: cur.addressLine1 || p.street || "",
      barangay: cur.barangay || p.barangay || "",
      municipality: cur.municipality || p.municipality || "",
      province: cur.province || p.province || "",
    }));
  }, []));

  if (!data) return <Screen>{error ? <Notice error={error} /> : <Skeleton kind="cards" rows={2} pad={0} what="Loading location" />}</Screen>;

  const { branch, role } = data;
  const isOwner = role === "OWNER";

  function openMap() {
    usePinPick.getState().open(pin ? { latitude: pin.latitude, longitude: pin.longitude } : null);
    router.push("/pin-map");
  }

  async function locate() {
    setLocating(true); setFailure(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Allow location, or use \"Move on map\" instead.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPin({ latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)), accuracy: Math.round(pos.coords.accuracy || 0) });
      setChanged(true);
    } catch (err) {
      setFailure(err);
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!pin) return setFailure(new Error("Set the store's location on the map first."));
    for (const key of ["addressLine1", "barangay", "municipality", "province"]) {
      if (!f[key].trim()) return setFailure(new Error("Fill in the street address, barangay, municipality and province."));
    }
    setBusy(true); setFailure(null);
    try {
      await call(`/branches/${branch.id}/location`, { method: "PUT", body: { ...f, latitude: pin.latitude, longitude: pin.longitude } });
      forgetCached(`${storeId}|/store`);
      toast("Store location saved.");
      router.back();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  }

  const pinText = !pin ? "No pin yet."
    : pin.saved ? `Saved pin: ${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}`
    : pin.onMap ? `New pin from the map: ${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}`
    : `New pin from your phone's location${pin.accuracy ? ` (within about ${pin.accuracy} m)` : ""}: ${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}`;

  return (
    <Screen>
      {!isOwner ? (
        <Card tone="attention"><Body>Only the store owner can change the location. Ask the owner if it is wrong.</Body></Card>
      ) : (
        <Text style={[s.sub, { marginBottom: 12 }]}>
          Drivers and customers use this to find you, and delivery fees are measured from the pin. Sentroh is told when it moves.
        </Text>
      )}
      <Card>
        <Field label="Street address" required hint="Purok, street or landmark." value={f.addressLine1} onChangeText={set("addressLine1")} editable={isOwner} />
        <Field label="More directions" optional hint="E.g. beside the barangay hall, blue gate." value={f.addressLine2} onChangeText={set("addressLine2")} editable={isOwner} />
        <Field label="Barangay" required value={f.barangay} onChangeText={set("barangay")} editable={isOwner} />
        <Field label="Municipality / city" required value={f.municipality} onChangeText={set("municipality")} editable={isOwner} />
        <Field label="Province" required value={f.province} onChangeText={set("province")} editable={isOwner} />
      </Card>
      <Card>
        <Text style={s.label}>Map pin<FieldTag required /></Text>
        <Text style={[s.body, { marginBottom: 8, color: pin && !pin.saved ? C.green : C.inkSoft }]}>{pinText}</Text>
        <Button title={isOwner ? "Check or move on map" : "See on map"} kind="secondary" onPress={openMap} />
        {isOwner ? <Button title="I'm at the store" kind="secondary" onPress={locate} busy={locating} style={{ marginTop: 8 }} /> : null}
      </Card>
      <Notice error={failure} />
      {isOwner ? <Button title="Save location" onPress={save} busy={busy} disabled={!changed} /> : null}
    </Screen>
  );
}
