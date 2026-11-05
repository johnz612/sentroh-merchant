import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Button, Card, Chip, Field, Label, Notice, s, Screen, Skeleton } from "@/components/ui";
import { forgetCached, updateCached } from "@/lib/cache";
import { money, WHY_HIDDEN } from "@/lib/format";
import { fileBytes, prepareProductPhoto } from "@/lib/photos";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";

const EMPTY = {
  name: "", displayName: "", description: "", brand: "", price: "", stockQty: "", sellingType: "UNIT",
  unitName: "", merchantSku: "", maxDeliveryQty: "", prepTimeMinutes: "", categoryId: null, onSale: false, trackStock: true,
};

const toText = (v) => (v == null ? "" : String(v));
const toNumber = (v) => (v === "" || v == null ? null : Number(String(v).replace(/,/g, "")));

/** Fields a POS product may change; everything else comes from Hatid POS. */
const POS_FIELDS = ["displayName", "description", "categoryId", "maxDeliveryQty", "prepTimeMinutes"];

function Photos({ product, call, canEdit, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const images = product.images || [];

  async function add(fromCamera) {
    setError(null);
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(new Error(fromCamera ? "Allow the camera to take a photo." : "Allow photo access to pick a photo."));

    const options = { mediaTypes: ["images"], quality: 1, allowsEditing: true, aspect: [1, 1] };
    const picked = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];

    setBusy(true);
    try {
      // Shrunk on the phone first: a ≤1280 px photo and a 320 px copy for lists (both JPEG).
      // An app installed before the shrinking module uploads the photo as picked, without a thumbnail.
      const { photo, thumb, contentType } = await prepareProductPhoto(asset);
      const { upload, thumbUpload } = await call(`/products/${product.id}/images/upload-url`, { method: "POST", body: { contentType } });
      const bucket = supabase.storage.from("product-images");
      const [up, upThumb] = await Promise.all([
        bucket.uploadToSignedUrl(upload.path, upload.token, await fileBytes(photo.uri), { contentType }),
        thumbUpload && thumb ? bucket.uploadToSignedUrl(thumbUpload.path, thumbUpload.token, await fileBytes(thumb.uri), { contentType: "image/jpeg" }) : { error: true },
      ]);
      if (up.error) throw new Error("The photo did not upload. Check your connection and try again.");
      // A failed small copy is not fatal: lists then use the full photo.
      const body = { path: upload.path, ...(thumbUpload && !upThumb.error ? { thumbPath: thumbUpload.path } : {}) };
      const json = await call(`/products/${product.id}/images`, { method: "POST", body });
      onChange(json.product);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function makeMain(image) {
    const order = [image.id, ...images.filter((i) => i.id !== image.id).map((i) => i.id)];
    try {
      const json = await call(`/products/${product.id}/images/order`, { method: "PUT", body: { imageIds: order } });
      onChange(json.product);
    } catch (err) { setError(err); }
  }

  function remove(image) {
    Alert.alert("Remove this photo?", "", [
      { text: "Keep", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await call(`/images/${image.id}`, { method: "DELETE" });
          onChange({ ...product, images: images.filter((i) => i.id !== image.id) });
        } catch (err) { setError(err); }
      } },
    ]);
  }

  return (
    <Card>
      <Label>Photos</Label>
      <Text style={[s.sub, { marginBottom: 8 }]}>Up to 5. The first one is what customers see in the list.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {images.map((img, idx) => (
          <Pressable key={img.id} disabled={!canEdit}
            onPress={() => Alert.alert("Photo", "", [
              ...(idx > 0 ? [{ text: "Make main photo", onPress: () => makeMain(img) }] : []),
              { text: "Remove", style: "destructive", onPress: () => remove(img) },
              { text: "Cancel", style: "cancel" },
            ])}
            style={{ marginRight: 8 }}>
            <Image source={{ uri: img.thumbnailUrl || img.url }} style={{ width: 84, height: 84, borderRadius: 8, borderWidth: idx === 0 ? 2 : 0, borderColor: C.teal }} contentFit="cover" />
            {idx === 0 ? <Text style={[s.sub, { textAlign: "center" }]}>Main</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
      <Notice error={error} />
      {canEdit && images.length < 5 ? (
        <View style={[s.row, { marginTop: 8 }]}>
          <Button title="Take photo" kind="secondary" style={{ flex: 1, marginRight: 8 }} busy={busy} onPress={() => add(true)} />
          <Button title="Choose photo" kind="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => add(false)} />
        </View>
      ) : null}
    </Card>
  );
}

function pickRule(g) {
  if (g.minSelect === 0) return `Optional, up to ${g.maxSelect}`;
  return g.minSelect === g.maxSelect ? `Pick ${g.minSelect} (required)` : `Pick ${g.minSelect} to ${g.maxSelect} (required)`;
}

/**
 * Sizes and add-ons of a dish. Owners and managers edit the groups; any
 * staff can mark one choice sold out for today (tap it).
 */
function Choices({ product, call, canEdit, onChange }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const groups = product.optionGroups || [];

  async function soldOut(option, until) {
    setError(null);
    try {
      await call("/options/sold-out", { method: "POST", body: { optionIds: [option.id], until } });
      const json = await call(`/products/${product.id}`);
      onChange(json.product);
    } catch (err) { setError(err); }
  }

  function tap(group, option) {
    Alert.alert(option.name, option.soldOutUntil ? "Sold out until midnight." : "", [
      option.soldOutUntil
        ? { text: "Available again now", onPress: () => soldOut(option, "CLEAR") }
        : { text: "Sold out today", onPress: () => soldOut(option, "TODAY") },
      ...(canEdit ? [{ text: `Edit ${group.name}`, onPress: () => router.push({ pathname: "/choice-group", params: { productId: product.id, groupId: group.id } }) }] : []),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <Card>
      <Label>Choices (sizes, add-ons)</Label>
      <Text style={[s.sub, { marginBottom: 8 }]}>
        {groups.length ? "Tap a choice to mark it sold out for today." : "Let customers pick a size, flavor or extras, each with its own added price."}
      </Text>
      {groups.map((g) => (
        <View key={g.id} style={{ marginBottom: 10 }}>
          <Pressable disabled={!canEdit} onPress={() => router.push({ pathname: "/choice-group", params: { productId: product.id, groupId: g.id } })}
            accessibilityRole="button" style={[s.row, { justifyContent: "space-between", marginBottom: 4 }]}>
            <Text style={[s.body, { fontWeight: "700", flex: 1 }]}>{g.name}{g.isActive === false ? " (hidden)" : ""}</Text>
            <Text style={s.sub}>{pickRule(g)}{canEdit ? "  ›" : ""}</Text>
          </Pressable>
          {g.options.map((o) => (
            <Pressable key={o.id} onPress={() => tap(g, o)} accessibilityRole="button"
              style={[s.row, { justifyContent: "space-between", paddingVertical: 6, paddingLeft: 8 }]}>
              <Text style={[s.body, { flex: 1 }, (o.isActive === false || o.soldOut) && { color: C.inkSoft }]}>
                {o.name}{o.isActive === false ? " (off)" : ""}{o.soldOut ? " · sold out today" : ""}
              </Text>
              <Text style={s.body}>{Number(o.priceDelta) > 0 ? `+${money(o.priceDelta)}` : "free"}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <Notice error={error} />
      {canEdit ? <Button title="Add choices" kind="secondary" onPress={() => router.push({ pathname: "/choice-group", params: { productId: product.id, groupId: "new" } })} /> : null}
    </Card>
  );
}

export default function ProductScreen() {
  const { productId } = useLocalSearchParams();
  const creating = productId === "new";
  const router = useRouter();
  const { storeId, store, call, canEdit, keyFor } = useStore();
  const productKey = creating ? undefined : keyFor(`/products/${productId}`);
  const loaded = useLoader(() => (creating ? Promise.resolve({ product: null }) : call(`/products/${productId}`)), [storeId, productId], { key: productKey });
  const cats = useLoader(() => call("/categories"), [storeId], { key: keyFor("/categories") });
  const [product, setProductState] = useState(null);
  // Typing is never overwritten by a background refresh.
  const edited = useRef(false);

  /** Shows the saved product and keeps the phone's copy and the lists up to date. */
  function setProduct(p) {
    setProductState((prev) => ({ ...p, images: p.images ?? prev?.images, optionGroups: p.optionGroups ?? prev?.optionGroups }));
    updateCached(productKey, (d) => ({ ...d, product: { ...d.product, ...p, images: p.images ?? d.product?.images, optionGroups: p.optionGroups ?? d.product?.optionGroups } }));
    forgetCached(`${storeId}|/products?`);
  }
  // Restaurants usually don't count dishes (like foodpanda and Grab); stores count stock.
  const [f, setF] = useState({ ...EMPTY, trackStock: store?.merchantType !== "FOOD_RESTAURANT" });
  const [stockInput, setStockInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    const p = loaded.data?.product;
    if (!p) return;
    setProductState(p);
    if (edited.current) return;
    setF({
      name: p.name, displayName: toText(p.displayName), description: toText(p.description), brand: toText(p.brand),
      price: toText(p.price), stockQty: toText(p.stockQty), sellingType: p.sellingType || "UNIT", unitName: toText(p.unitName),
      merchantSku: toText(p.merchantSku), maxDeliveryQty: toText(p.maxDeliveryQty), prepTimeMinutes: toText(p.prepTimeMinutes || ""),
      categoryId: p.categoryId, onSale: p.onSale, trackStock: p.trackStock !== false,
    });
    setStockInput(toText(p.stockQty));
  }, [loaded.data]);

  if (!creating && !product) return <Screen>{loaded.error ? <Notice error={loaded.error} /> : <Skeleton kind="cards" rows={4} pad={0} what="Loading product" />}</Screen>;

  const pos = product?.managedByPos === true;
  const set = (key) => (v) => { edited.current = true; setF({ ...f, [key]: v }); };

  function body() {
    const all = {
      name: f.name.trim(), displayName: f.displayName.trim() || null, description: f.description.trim() || null, brand: f.brand.trim() || null,
      price: toNumber(f.price), stockQty: toNumber(f.stockQty), sellingType: f.sellingType, unitName: f.unitName.trim() || null,
      merchantSku: f.merchantSku.trim() || null, maxDeliveryQty: toNumber(f.maxDeliveryQty), prepTimeMinutes: toNumber(f.prepTimeMinutes),
      categoryId: f.categoryId, onSale: f.onSale, trackStock: f.trackStock,
    };
    if (creating) {
      Object.keys(all).forEach((k) => (all[k] === null || all[k] === "") && delete all[k]);
      return all;
    }
    // On/off is saved immediately by the switch (any staff may change it).
    const keys = pos ? POS_FIELDS : Object.keys(all).filter((k) => k !== "onSale");
    return Object.fromEntries(keys.map((k) => [k, all[k]]));
  }

  async function save() {
    setBusy(true); setError(null); setDone(null);
    try {
      if (creating) {
        const json = await call("/products", { method: "POST", body: body() });
        forgetCached(`${storeId}|/products?`);
        router.replace(`/product/${json.product.id}`);
        return;
      }
      const json = await call(`/products/${product.id}`, { method: "PATCH", body: body() });
      setProduct(json.product);
      edited.current = false;
      setDone("Saved.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveStock() {
    setError(null); setDone(null);
    try {
      const json = await call(`/products/${product.id}/stock`, { method: "POST", body: { stockQty: toNumber(stockInput) } });
      setProduct(json.product);
      setF((x) => ({ ...x, stockQty: toText(json.product.stockQty) }));
      setDone("Stock updated.");
    } catch (err) { setError(err); }
  }

  async function toggleOnSale(onSale) {
    setF((x) => ({ ...x, onSale })); setError(null); setDone(null);
    try {
      await call("/products/on-sale", { method: "POST", body: { onSale, productIds: [product.id] } });
      const json = await call(`/products/${product.id}`);
      setProduct(json.product);
    } catch (err) {
      setF((x) => ({ ...x, onSale: !onSale }));
      setError(err);
    }
  }

  async function soldOut(until) {
    setError(null); setDone(null);
    try {
      await call("/products/sold-out", { method: "POST", body: { productIds: [product.id], until } });
      const json = await call(`/products/${product.id}`);
      setProduct(json.product);
      setDone(until === "TODAY" ? "Marked sold out until midnight." : "Available again.");
    } catch (err) { setError(err); }
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    try {
      const json = await call("/categories", { method: "POST", body: { name: newCategory.trim() } });
      setNewCategory("");
      setF((x) => ({ ...x, categoryId: json.category.categoryId }));
      cats.reload();
    } catch (err) { setError(err); }
  }

  function removeProduct() {
    Alert.alert("Remove this product?", "It disappears from your store. Past orders keep it.", [
      { text: "Keep", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await call(`/products/${product.id}`, { method: "DELETE" }); forgetCached(`${storeId}|/products`); router.back(); } catch (err) { setError(err); }
      } },
    ]);
  }

  const storeCategories = cats.data?.categories?.filter((c) => c.isActive) || [];

  return (
    <Screen>
      <Stack.Screen options={{ title: creating ? "New product" : "Edit product" }} />
      {product && !product.shownToCustomers ? (
        <Notice kind="info">Customers can't see this product: {WHY_HIDDEN[product.hiddenReason] || "hidden"}.{product.hiddenBySentrohReason ? ` Sentroh: ${product.hiddenBySentrohReason}` : ""}</Notice>
      ) : null}
      <Notice kind="ok">{done}</Notice>

      <Card>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View style={{ flex: 1 }}>
            <Label>On sale</Label>
            <Text style={s.sub}>Off means customers can't order it.</Text>
          </View>
          <Switch value={f.onSale} onValueChange={creating ? set("onSale") : toggleOnSale} trackColor={{ true: C.teal, false: "#C8D1CE" }} thumbColor="#fff" />
        </View>
      </Card>

      {!creating ? (
        <Card tone={product.soldOutUntil ? "attention" : undefined}>
          <Label>{product.soldOutUntil ? "Sold out today" : "Ran out?"}</Label>
          <Text style={[s.sub, { marginBottom: 8 }]}>
            {product.soldOutUntil
              ? "Customers can't order it until midnight. It comes back by itself."
              : "Mark it sold out for the rest of today. It comes back by itself at midnight."}
          </Text>
          {product.soldOutUntil
            ? <Button title="Available again now" kind="secondary" onPress={() => soldOut("CLEAR")} />
            : <Button title="Sold out today" kind="attention" onPress={() => soldOut("TODAY")} />}
        </Card>
      ) : null}

      {!creating ? <Photos product={product} call={call} canEdit={canEdit} onChange={setProduct} /> : null}

      {!creating && !pos && product.sellingType === "UNIT" ? <Choices product={product} call={call} canEdit={canEdit} onChange={setProduct} /> : null}

      <Card>
        {pos ? (
          <>
            <Notice kind="info">This product comes from Hatid POS. Change its name, price and stock in the POS; they sync here.</Notice>
            <Body style={{ fontWeight: "700" }}>{product.name}</Body>
            <Body muted>{money(product.price)}, {product.stockQty}{product.stockUnit === "KG" ? " kg" : ""} in stock</Body>
            <View style={{ height: 12 }} />
            <Field label="Name shown online" hint="Optional. Leave empty to use the POS name." value={f.displayName} onChangeText={set("displayName")} editable={canEdit} />
          </>
        ) : (
          <>
            <Field label="Name" value={f.name} onChangeText={set("name")} editable={canEdit} />
            <Text style={s.label}>Sold</Text>
            <View style={[s.row, { marginBottom: 12 }]}>
              <Chip label="Per piece" active={f.sellingType === "UNIT"} onPress={() => canEdit && set("sellingType")("UNIT")} />
              <Chip label="By weight (kg)" active={f.sellingType === "WEIGHT"} onPress={() => canEdit && set("sellingType")("WEIGHT")} />
            </View>
            <Field label={f.sellingType === "WEIGHT" ? "Price per kg (₱)" : "Price (₱)"} keyboardType="decimal-pad" value={f.price} onChangeText={set("price")} editable={canEdit} />
            <View style={[s.row, { justifyContent: "space-between", marginBottom: 12 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[s.body, { fontWeight: "600" }]}>Count stock</Text>
                <Text style={s.sub}>{f.trackStock ? "Sales lower the count; at 0 customers can't order it." : "No count. Use \"Sold out today\" when you run out."}</Text>
              </View>
              <Switch value={f.trackStock} disabled={!canEdit} onValueChange={set("trackStock")} trackColor={{ true: C.teal, false: "#C8D1CE" }} thumbColor="#fff" />
            </View>
            {creating && f.trackStock ? (
              <Field label={f.sellingType === "WEIGHT" ? "Stock (kg)" : "Stock"} keyboardType="decimal-pad" value={f.stockQty} onChangeText={set("stockQty")} />
            ) : null}
            <Field label="Brand" value={f.brand} onChangeText={set("brand")} editable={canEdit} />
            <Field label="Unit or size" hint="For example 1 L bottle, 500 g pack, small plate." value={f.unitName} onChangeText={set("unitName")} editable={canEdit} />
            <Field label="Your code (SKU)" value={f.merchantSku} onChangeText={set("merchantSku")} editable={canEdit} />
          </>
        )}
        <Field label="Description" value={f.description} onChangeText={set("description")} multiline editable={canEdit} />
      </Card>

      {!creating && !pos && product.trackStock ? (
        <Card>
          <Label>Stock</Label>
          <Text style={[s.sub, { marginBottom: 8 }]}>Any staff can update this.</Text>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field label={product.stockUnit === "KG" ? "In stock (kg)" : "In stock"} keyboardType="decimal-pad" value={stockInput} onChangeText={(v) => { edited.current = true; setStockInput(v); }} />
            </View>
            <Button title="Update" kind="secondary" onPress={saveStock} style={{ marginTop: 8 }} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Label>Category</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          <View style={{ marginBottom: 8 }}><Chip label="None" active={!f.categoryId} onPress={() => canEdit && set("categoryId")(null)} /></View>
          {storeCategories.map((c) => (
            <View key={c.id} style={{ marginBottom: 8 }}><Chip label={c.name} active={f.categoryId === c.id} onPress={() => canEdit && set("categoryId")(c.id)} /></View>
          ))}
        </View>
        {pos && product.posCategoryName ? <Text style={[s.sub, { marginBottom: 8 }]}>POS category: {product.posCategoryName}. Customers see this unless you pick one above.</Text> : null}
        {canEdit ? (
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 8 }}><Field label="New category" value={newCategory} onChangeText={setNewCategory} placeholder="e.g. Rice meals" /></View>
            <Button title="Add" kind="secondary" onPress={addCategory} style={{ marginTop: 8 }} />
          </View>
        ) : null}
      </Card>

      <Card>
        <Field label="Most per delivery order" hint="Optional limit, e.g. 2 for bulky items." keyboardType="number-pad" value={f.maxDeliveryQty} onChangeText={set("maxDeliveryQty")} editable={canEdit} />
        <Field label="Preparation time (minutes)" hint="Optional, mostly for food." keyboardType="number-pad" value={f.prepTimeMinutes} onChangeText={set("prepTimeMinutes")} editable={canEdit} />
      </Card>

      <Notice error={error} />
      {canEdit ? <Button title={creating ? "Add product" : "Save changes"} onPress={save} busy={busy} /> : <Notice kind="info">Only the owner or a manager can edit products. You can switch them on or off and update stock.</Notice>}
      {!creating && canEdit && !pos ? <Button title="Remove product" kind="danger" style={{ marginTop: 12 }} onPress={removeProduct} /> : null}
    </Screen>
  );
}
