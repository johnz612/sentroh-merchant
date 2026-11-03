import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";

import { useLoader, useStore } from "@/components/hooks";
import { Button, Card, Chip, Field, Label, Notice, s, Screen, Skeleton } from "@/components/ui";
import { forgetCached } from "@/lib/cache";
import { C } from "@/lib/theme";

const toNumber = (v) => (v === "" || v == null ? NaN : Number(String(v).replace(/,/g, "")));
let nextKey = 1;
const blankOption = () => ({ key: `n${nextKey++}`, name: "", priceDelta: "0", isActive: true, isDefault: false });

/** Quick picks for the usual kinds of group. */
const PRESETS = [
  { label: "Pick 1 (required)", min: 1, max: 1, hint: "Like a size or a flavor." },
  { label: "Optional extras", min: 0, max: 3, hint: "Like add-ons. The customer may skip them." },
];

/**
 * Add or edit one group of choices for a dish, e.g. "Size" (pick 1) or
 * "Add-ons" (pick up to 3). Owners and managers only; the server checks.
 * Params: productId, groupId ("new" to add).
 */
export default function ChoiceGroupScreen() {
  const { productId, groupId } = useLocalSearchParams();
  const creating = groupId === "new";
  const router = useRouter();
  const { storeId, call, canEdit, keyFor } = useStore();
  const productKey = keyFor(`/products/${productId}`);
  const loaded = useLoader(() => call(`/products/${productId}`), [storeId, productId], { key: productKey });
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const touched = useRef(false);

  useEffect(() => {
    const product = loaded.data?.product;
    if (!product || touched.current) return;
    const group = (product.optionGroups || []).find((g) => g.id === groupId);
    if (!creating && !group) return;
    setF(group
      ? {
        name: group.name, min: String(group.minSelect), max: String(group.maxSelect), isActive: group.isActive !== false,
        options: group.options.map((o) => ({ key: o.id, id: o.id, name: o.name, priceDelta: String(o.priceDelta), isActive: o.isActive !== false, isDefault: o.isDefault === true })),
      }
      : { name: "", min: "1", max: "1", isActive: true, options: [blankOption(), blankOption()] });
  }, [loaded.data, groupId, creating]);

  const product = loaded.data?.product;
  if (!f) {
    const missing = product && !creating;
    return <Screen>{loaded.error ? <Notice error={loaded.error} /> : missing ? <Notice error={new Error("This group was removed.")} /> : <Skeleton kind="cards" rows={3} pad={0} what="Loading choices" />}</Screen>;
  }

  const change = (patch) => { touched.current = true; setF((x) => ({ ...x, ...patch })); };
  const changeOption = (key, patch) => change({ options: f.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  const removeOption = (key) => change({ options: f.options.filter((o) => o.key !== key) });

  function body() {
    return {
      name: f.name.trim(),
      minSelect: toNumber(f.min),
      maxSelect: toNumber(f.max),
      isActive: f.isActive,
      options: f.options
        .filter((o) => o.name.trim() || o.id)
        .map((o) => ({ ...(o.id ? { id: o.id } : {}), name: o.name.trim(), priceDelta: toNumber(o.priceDelta || "0"), isActive: o.isActive, isDefault: o.isDefault })),
    };
  }

  function done() {
    forgetCached(productKey);
    forgetCached(`${storeId}|/products?`);
    router.back();
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      const path = creating ? `/products/${productId}/options` : `/products/${productId}/options/${groupId}`;
      await call(path, { method: creating ? "POST" : "PUT", body: body() });
      done();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    Alert.alert(`Remove "${f.name || "this group"}"?`, "Customers won't see these choices anymore. Past orders keep them.", [
      { text: "Keep", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await call(`/products/${productId}/options/${groupId}`, { method: "DELETE" }); done(); } catch (err) { setError(err); }
      } },
    ]);
  }

  const min = toNumber(f.min);
  const max = toNumber(f.max);
  const rule = Number.isInteger(min) && Number.isInteger(max)
    ? min === 0 ? `Optional: the customer may pick up to ${max}.` : min === max ? `Required: the customer picks exactly ${min}.` : `Required: the customer picks ${min} to ${max}.`
    : "Enter whole numbers.";

  return (
    <Screen>
      <Stack.Screen options={{ title: creating ? "New choices" : "Edit choices" }} />
      {product ? <Text style={[s.sub, { marginBottom: 8 }]}>For {product.displayName || product.name}</Text> : null}

      <Card>
        <Field label="Group name" placeholder="e.g. Size, Flavor, Add-ons" value={f.name} onChangeText={(v) => change({ name: v })} editable={canEdit} maxLength={60} />
        <Text style={s.label}>How many can the customer pick?</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          {PRESETS.map((p) => (
            <View key={p.label} style={{ marginBottom: 8 }}>
              <Chip label={p.label} active={min === p.min && max === p.max} onPress={() => canEdit && change({ min: String(p.min), max: String(p.max) })} />
            </View>
          ))}
        </View>
        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label="At least" keyboardType="number-pad" value={f.min} onChangeText={(v) => change({ min: v })} editable={canEdit} /></View>
          <View style={{ flex: 1 }}><Field label="At most" keyboardType="number-pad" value={f.max} onChangeText={(v) => change({ max: v })} editable={canEdit} /></View>
        </View>
        <Text style={s.sub}>{rule}</Text>
        <View style={[s.row, { justifyContent: "space-between", marginTop: 12 }]}>
          <Text style={[s.body, { fontWeight: "600" }]}>Show these choices</Text>
          <Switch value={f.isActive} disabled={!canEdit} onValueChange={(v) => change({ isActive: v })} trackColor={{ true: C.teal, false: "#C8D1CE" }} thumbColor="#fff" />
        </View>
      </Card>

      <Card>
        <Label>Choices</Label>
        <Text style={[s.sub, { marginBottom: 8 }]}>Added price is on top of the dish price. Use 0 for no extra charge.</Text>
        {f.options.map((o, i) => (
          <View key={o.key} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: C.line, paddingTop: i ? 10 : 0, marginBottom: 6 }}>
            <View style={s.row}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Field label={`Choice ${i + 1}`} placeholder={i === 0 ? "e.g. Regular" : "e.g. Large"} value={o.name} onChangeText={(v) => changeOption(o.key, { name: v })} editable={canEdit} maxLength={60} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="+ ₱" keyboardType="decimal-pad" value={o.priceDelta} onChangeText={(v) => changeOption(o.key, { priceDelta: v })} editable={canEdit} />
              </View>
              {canEdit ? (
                <Pressable onPress={() => removeOption(o.key)} accessibilityRole="button" accessibilityLabel={`Remove choice ${i + 1}`} hitSlop={10} style={{ paddingLeft: 8, paddingTop: 12 }}>
                  <Ionicons name="close-circle-outline" size={24} color={C.inkSoft} />
                </Pressable>
              ) : null}
            </View>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={s.sub}>Ticked at first</Text>
              <Switch value={o.isDefault} disabled={!canEdit} onValueChange={(v) => changeOption(o.key, { isDefault: v })} trackColor={{ true: C.teal, false: "#C8D1CE" }} thumbColor="#fff" />
              <Text style={[s.sub, { marginLeft: 12 }]}>On</Text>
              <Switch value={o.isActive} disabled={!canEdit} onValueChange={(v) => changeOption(o.key, { isActive: v })} trackColor={{ true: C.teal, false: "#C8D1CE" }} thumbColor="#fff" />
            </View>
          </View>
        ))}
        {canEdit && f.options.length < 50 ? <Button title="Add a choice" kind="secondary" onPress={() => change({ options: [...f.options, blankOption()] })} /> : null}
      </Card>

      <Notice error={error} />
      {canEdit ? <Button title={creating ? "Add choices" : "Save choices"} onPress={save} busy={busy} /> : <Notice kind="info">Only the owner or a manager can change choices.</Notice>}
      {canEdit && !creating ? <Button title="Remove this group" kind="danger" style={{ marginTop: 12 }} onPress={remove} /> : null}
    </Screen>
  );
}
