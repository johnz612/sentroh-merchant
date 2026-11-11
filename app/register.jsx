import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button, Card, Chip, Field, FieldTag, Notice, Screen, Title, s } from "@/components/ui";
import { api } from "@/lib/api";
import { unregisterPush } from "@/lib/push";
import { usePinPick } from "@/lib/pinPick";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";

/** Shown to signed-in people with no store: register one (it waits for Sentroh's approval). */
export default function Register() {
  const load = useSession((st) => st.load);
  const phone = useSession((st) => st.phone);
  const [f, setF] = useState({ ownerName: "", businessName: "", merchantType: "RETAIL_GOODS", addressLine1: "", barangay: "", municipality: "", province: "" });
  const [pin, setPin] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const set = (key) => (v) => setF({ ...f, [key]: v });

  // Back from the map: use the chosen spot, and fill empty address fields from it.
  useFocusEffect(useCallback(() => {
    const picked = usePinPick.getState().take();
    if (!picked) return;
    setPin({ latitude: picked.latitude, longitude: picked.longitude, onMap: true });
    const p = picked.place || {};
    setF((cur) => ({
      ...cur,
      addressLine1: cur.addressLine1 || p.street || "",
      barangay: cur.barangay || p.barangay || "",
      municipality: cur.municipality || p.municipality || "",
      province: cur.province || p.province || "",
    }));
  }, []));

  function openMap() {
    usePinPick.getState().open(pin ? { latitude: pin.latitude, longitude: pin.longitude } : null);
    router.push("/pin-map");
  }

  async function locate() {
    setLocating(true); setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Allow location, or use \"Set on map\" instead.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPin({ latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)), accuracy: Math.round(pos.coords.accuracy || 0) });
    } catch (err) {
      setError(err);
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    setError(null);
    if (!pin) return setError(new Error("Pin your store's location first: \"Set on map\" or \"I'm at the store\"."));
    setBusy(true);
    try {
      await api("/api/v1/merchant/sign-up", {
        method: "POST",
        body: {
          ownerName: f.ownerName,
          store: { businessName: f.businessName, merchantType: f.merchantType },
          branch: { addressLine1: f.addressLine1, barangay: f.barangay, municipality: f.municipality, province: f.province, latitude: pin.latitude, longitude: pin.longitude },
        },
      });
      await load();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  async function signOut() {
    await unregisterPush();
    await supabase.auth.signOut();
  }

  return (
    <Screen>
      <Title sub={`Signed in as ${phone || "you"}. Sentroh reviews new stores, usually within a day. While you wait you can add products and set your hours.`}>
        Register your store
      </Title>

      <Card>
        <Field label="Your full name" required hint="The owner. Sentroh uses it to check and contact the store." value={f.ownerName} onChangeText={set("ownerName")} autoCapitalize="words" />
        <Field label="Store name" required hint="The name customers see in Sentroh." value={f.businessName} onChangeText={set("businessName")} />
        <Text style={s.label}>Type of store<FieldTag required /></Text>
        <Text style={[s.sub, { marginBottom: 4 }]}>Restaurants get menus with sizes and add-ons, and preparing time.</Text>
        <View style={[s.row, { marginBottom: 12 }]}>
          <Chip label="Store / retail" active={f.merchantType === "RETAIL_GOODS"} onPress={() => set("merchantType")("RETAIL_GOODS")} />
          <Chip label="Restaurant / food" active={f.merchantType === "FOOD_RESTAURANT"} onPress={() => set("merchantType")("FOOD_RESTAURANT")} />
        </View>
      </Card>

      <Card>
        <Field label="Street address" required hint="Helps drivers and customers find the store." placeholder="Purok, street, landmark" value={f.addressLine1} onChangeText={set("addressLine1")} />
        <Field label="Barangay" required value={f.barangay} onChangeText={set("barangay")} />
        <Field label="Municipality / city" required value={f.municipality} onChangeText={set("municipality")} />
        <Field label="Province" required value={f.province} onChangeText={set("province")} />
        <Text style={s.label}>Store location<FieldTag required /></Text>
        <Text style={[s.sub, { marginBottom: 8 }]}>Drivers and customers use this pin to find you. Move the map so the pin is on your store, or tap "I'm at the store" when you are inside it, then check it on the map.</Text>
        {pin ? (
          <Text style={[s.body, { marginBottom: 8, color: C.green }]}>
            {pin.onMap ? "Pinned on the map" : `Pinned from your phone's location${pin.accuracy ? ` (within about ${pin.accuracy} m)` : ""}`}: {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
          </Text>
        ) : null}
        <Button title={pin ? "Check or move on map" : "Set on map"} kind={pin && !pin.onMap ? "primary" : "secondary"} onPress={openMap} />
        <Button title="I'm at the store" kind="secondary" onPress={locate} busy={locating} style={{ marginTop: 8 }} />
      </Card>

      <Notice error={error} />
      <Button title="Send for approval" onPress={submit} busy={busy} />
      <Pressable onPress={signOut} style={{ marginTop: 20, alignSelf: "center" }}>
        <Text style={[s.body, { color: C.inkSoft }]}>Sign out</Text>
      </Pressable>
      <Text style={[s.sub, { marginTop: 16, textAlign: "center" }]}>
        Staff of an existing store: ask the store owner or Sentroh to add your number, then sign in again.
      </Text>
    </Screen>
  );
}
