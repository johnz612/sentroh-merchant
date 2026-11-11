import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProductImage } from "@/components/ProductImage";
import { useLoader, useStore } from "@/components/hooks";
import { Body, Button, Card, Chip, Empty, Loading, Notice, s, Skeleton } from "@/components/ui";
import { cached, prefetch, updateCached } from "@/lib/cache";
import { money, WHY_HIDDEN } from "@/lib/format";
import { C } from "@/lib/theme";
import { toast } from "@/lib/toast";

const VIEWS = [["ALL", "All"], ["ON_SALE", "On sale"], ["OFF", "Off"], ["SOLD_OUT_TODAY", "Sold out today"], ["OUT_OF_STOCK", "Out of stock"], ["HIDDEN_BY_SENTROH", "Hidden by Sentroh"]];


const ProductRow = memo(function ProductRow({ p, onToggle, onOpen, onPrefetch, toggling }) {
  return (
    <Pressable onPress={() => onOpen(p.id)} onPressIn={() => onPrefetch(p.id)} accessibilityRole="button">
      <View style={[s.card, s.row, { paddingVertical: 10 }]}>
        {p.thumbnailUrl || p.imageUrl
          ? <ProductImage uri={p.thumbnailUrl || p.imageUrl} fill={p.productKind === "COOKED_FOOD"} style={{ width: 52, height: 52, borderRadius: 8, marginRight: 12 }} recyclingKey={p.id} transition={100} />
          : <View style={{ width: 52, height: 52, borderRadius: 8, marginRight: 12, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" }}><Ionicons name="image-outline" size={22} color={C.inkSoft} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={[s.body, { fontWeight: "600" }]} numberOfLines={2}>{p.displayName || p.name}</Text>
          <Text style={s.sub}>
            {money(p.price)}, {p.trackStock ? `${p.stockQty}${p.stockUnit === "KG" ? " kg" : ""} in stock` : "stock not counted"}{p.managedByPos ? ", from POS" : ""}
          </Text>
          {!p.shownToCustomers && p.onSale ? <Text style={[s.sub, { color: p.hiddenReason === "HIDDEN_BY_SENTROH" ? C.red : C.mangoInk }]}>Customers can't see it: {WHY_HIDDEN[p.hiddenReason] || "hidden"}</Text> : null}
          {p.missingForSale?.length ? (
            <Text style={[s.sub, { color: C.mangoInk }]}>
              Needs {p.missingForSale.map((m) => (m === "PHOTO" ? "a photo" : "a menu section")).join(" and ")} before it can be on sale
            </Text>
          ) : null}
          {p.hiddenReason === "HIDDEN_BY_SENTROH" && p.hiddenBySentrohReason ? <Text style={[s.sub, { color: C.red }]}>{p.hiddenBySentrohReason}</Text> : null}
        </View>
        <Switch value={p.onSale} onValueChange={(v) => onToggle(p, v)} disabled={toggling}
          trackColor={{ true: C.teal, false: "#C8D1CE" }} thumbColor="#fff" accessibilityLabel={`On sale: ${p.name}`} />
      </View>
    </Pressable>
  );
});

/** Turn a whole POS category on or off (only in-stock items when turning on). */
function CategorySheet({ open, onClose, call, onDone }) {
  const cats = useLoader(() => (open ? call("/categories") : Promise.resolve(null)), [open]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  if (!open) return null;

  async function run(cat, onSale) {
    setBusy(cat.id); setError(null);
    try {
      const json = await call("/products/on-sale", { method: "POST", body: { onSale, posCategoryId: cat.id, onlyInStock: onSale } });
      onDone(`${cat.name}: ${json.result.changed} product${json.result.changed === 1 ? "" : "s"} turned ${onSale ? "on" : "off"}.`);
      cats.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal animationType="slide" visible onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={s.title}>POS categories</Text>
          <Body muted style={{ marginBottom: 12 }}>Turn on a whole category at once. Only items with stock are turned on.</Body>
          <Notice error={error || cats.error} />
          {!cats.data ? <Loading /> : cats.data.posCategories.length === 0 ? <Empty title="No POS categories">Your products are not from Hatid POS.</Empty> : cats.data.posCategories.map((c) => (
            <Card key={c.id}>
              <Text style={[s.body, { fontWeight: "700" }]}>{c.name}</Text>
              <Text style={s.sub}>{c.onSaleCount} of {c.productCount} on sale</Text>
              <View style={[s.row, { marginTop: 8 }]}>
                <Button title="Turn on in-stock" style={{ flex: 1, marginRight: 8 }} busy={busy === c.id} onPress={() => run(c, true)} />
                <Button title="Turn all off" kind="secondary" style={{ flex: 1 }} disabled={busy === c.id} onPress={() => run(c, false)} />
              </View>
            </Card>
          ))}
          <Button title="Done" kind="secondary" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function Products() {
  const router = useRouter();
  const navigation = useNavigation();
  const { storeId, call, canEdit, keyFor } = useStore();
  const [view, setView] = useState("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState(() => cached(keyFor("/products", { view: "ALL", search: "", page: 1, limit: 40 }))?.products || []);
  const [toggling, setToggling] = useState(null);
  const [failure, setFailure] = useState(null);
  const [categories, setCategories] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [view, query, storeId]);

  const listQuery = (n) => ({ view, search: query, page: n, limit: 40 });
  const { data, error, loading, refreshing, reload, refresh } = useLoader(
    () => call("/products", { query: listQuery(page) }), [storeId, view, query, page],
    { key: keyFor("/products", listQuery(page)) },
  );

  const shownOnce = useRef(false);
  useEffect(() => {
    if (!data) return;
    shownOnce.current = true;
    setItems((prev) => {
      if (page === 1) return data.products;
      const seen = new Set(prev.map((x) => x.id));
      return [...prev, ...data.products.filter((p) => !seen.has(p.id))];
    });
    // Fetch the next page ahead so scrolling never waits.
    if (data.pagination?.hasNextPage) prefetch(keyFor("/products", listQuery(page + 1)), () => call("/products", { query: listQuery(page + 1) }));
  }, [data, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from a product that was changed: its list copy was dropped, so load page 1 again.
  useFocusEffect(useCallback(() => {
    if (!shownOnce.current || cached(keyFor("/products", listQuery(1))) !== undefined) return;
    if (page === 1) reload(); else setPage(1);
  }, [storeId, view, query, page])); // eslint-disable-line react-hooks/exhaustive-deps

  const openProduct = useCallback((id) => router.push(`/product/${id}`), [router]);
  const loadProduct = useCallback((id) => prefetch(keyFor(`/products/${id}`), () => call(`/products/${id}`), { maxAgeMs: 15000 }), [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => canEdit ? (
        <Pressable onPress={() => router.push("/product/new")} style={{ marginRight: 16 }} accessibilityLabel="Add a product">
          <Ionicons name="add-circle" size={30} color={C.teal} />
        </Pressable>
      ) : null,
    });
  }, [navigation, canEdit, router]);

  const toggle = useCallback(async (p, onSale) => {
    setToggling(p.id); setFailure(null);
    setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, onSale } : x)));
    try {
      await call("/products/on-sale", { method: "POST", body: { onSale, productIds: [p.id] } });
      // Keep the phone's copy in step, so the list doesn't flip back when reopened.
      for (let n = 1; n <= page; n++) {
        updateCached(keyFor("/products", listQuery(n)), (d) => ({ ...d, products: d.products.map((x) => (x.id === p.id ? { ...x, onSale } : x)) }));
      }
    } catch (err) {
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, onSale: !onSale } : x)));
      setFailure(err);
    } finally {
      setToggling(null);
    }
  }, [storeId, view, query, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <TextInput placeholder="Search products" placeholderTextColor="#8A97A8" value={search} onChangeText={setSearch} style={[s.input, { marginBottom: 8 }]} returnKeyType="search" />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {VIEWS.map(([v, label]) => <Chip key={v} label={label} active={view === v} onPress={() => setView(v)} />)}
          <Chip label="POS categories" onPress={() => setCategories(true)} />
        </ScrollView>
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <Notice error={failure || error} />
      </View>
      {loading && items.length === 0 ? <Skeleton rows={8} what="Loading products" /> : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (page === 1 ? refresh() : setPage(1))} tintColor={C.teal} />}
          renderItem={({ item }) => <ProductRow p={item} toggling={toggling === item.id} onToggle={toggle} onPrefetch={loadProduct} onOpen={openProduct} />}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          removeClippedSubviews
          onEndReached={() => { if (data?.pagination?.hasNextPage && !loading) setPage((n) => n + 1); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loading && !data && items.length > 0 ? <Loading what="Loading more" /> : null}
          ListEmptyComponent={<Empty title={query ? "No products match" : "No products here"}>{canEdit && !query ? "Tap + to add your first product." : null}</Empty>}
        />
      )}
      <CategorySheet open={categories} call={call} onClose={() => { setCategories(false); setPage(1); reload(); }} onDone={toast} />
    </View>
  );
}
