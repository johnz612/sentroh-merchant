import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { memo, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { useLoader, useStore } from "@/components/hooks";
import { cached, prefetch } from "@/lib/cache";
import { Card, Chip, Empty, Notice, Pill, s, Skeleton } from "@/components/ui";
import { ago, clock, minutesLeft, money, STATUS_TEXT } from "@/lib/format";
import { C } from "@/lib/theme";

// Once a driver has the order, the store's part is done; it shows under Done as "With driver".
const FILTERS = [
  ["NEW", "New"],
  ["PREPARING", "Preparing"],
  ["READY", "Ready"],
  ["DONE", "Done"],
  ["CANCELLED", "Cancelled"],
];

function fulfillment(o) {
  if (o.fulfillmentType === "PICKUP") return "Pickup";
  if (o.deliveryService === "STANDARD") return `Standard delivery${o.standardDepartureAt ? `, leaves ${clock(o.standardDepartureAt)}` : ""}`;
  return "Express delivery";
}

const OrderRow = memo(function OrderRow({ order, onPress, onPressIn }) {
  const left = order.status === "PENDING" ? minutesLeft(order.acceptBy) : null;
  const isNew = order.status === "PENDING";
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} accessibilityRole="button">
      <Card tone={isNew ? "attention" : undefined}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink }}>#{order.orderNumber}</Text>
          <Text style={[s.body, { fontWeight: "700" }]}>{money(order.subtotal)}</Text>
        </View>
        <Text style={[s.body, { marginTop: 2 }]}>{order.customerName}, {order.itemCount} item{order.itemCount === 1 ? "" : "s"}</Text>
        <Text style={s.sub}>{fulfillment(order)}, {order.paymentMethod === "GCASH" ? "GCash" : "Cash"}</Text>
        <View style={[s.row, { justifyContent: "space-between", marginTop: 8 }]}>
          {isNew
            ? <Pill tone="attention" text={left === 0 ? "Accept now" : `Accept within ${left} min`} />
            : <Pill tone={order.status === "CANCELLED" ? "stopped" : order.status === "COMPLETED" ? "done" : order.status === "STOCK_ISSUE" ? "attention" : "active"} text={STATUS_TEXT[order.status] || order.status} />}
          <Text style={s.sub}>{ago(order.createdAt)}</Text>
        </View>
      </Card>
    </Pressable>
  );
});

export default function Orders() {
  const router = useRouter();
  const { storeId, call, keyFor } = useStore();
  const [filter, setFilter] = useState("NEW");
  // The New tab's own list already has the count; the small count call is only for the other tabs.
  const onNew = filter === "NEW";
  const newCount = useLoader(() => (onNew ? Promise.resolve(null) : call("/orders", { query: { filter: "NEW", limit: 1 } })), [storeId, onNew],
    { intervalMs: onNew ? undefined : 20000, key: onNew ? undefined : keyFor("/orders", { filter: "NEW", limit: 1 }) });
  const { data, error, loading, refreshing, reload, refresh } = useLoader(
    () => call("/orders", { query: { filter, limit: 50 } }), [storeId, filter],
    { intervalMs: 20000, key: keyFor("/orders", { filter, limit: 50 }) },
  );

  // Open orders' details are fetched ahead, so tapping one opens instantly.
  const loadOrder = (id) => prefetch(keyFor(`/orders/${id}`), () => call(`/orders/${id}`), { maxAgeMs: 15000 });
  useEffect(() => {
    for (const o of (data?.orders || []).slice(0, 8)) {
      if (cached(keyFor(`/orders/${o.id}`))?.order?.status !== o.status) loadOrder(o.id);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new-order alert while the app is open refreshes the list right away.
  const reloadNew = newCount.reload;
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => { reload(); reloadNew(); });
    return () => sub.remove();
  }, [reload, reloadNew]);

  const pending = (onNew ? data?.pagination?.total : newCount.data?.pagination?.total) ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: 12, paddingBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {FILTERS.map(([value, label]) => (
            <Chip key={value} label={label} count={value === "NEW" && pending > 0 ? pending : null} active={filter === value} onPress={() => setFilter(value)} />
          ))}
        </ScrollView>
      </View>
      {error ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Notice error={error} /></View> : null}
      {loading && !data ? <Skeleton kind="cards" rows={5} what="Loading orders" /> : (
        <FlatList
          data={data?.orders || []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); reloadNew(); }} tintColor={C.teal} />}
          renderItem={({ item }) => <OrderRow order={item} onPressIn={() => loadOrder(item.id)} onPress={() => router.push(`/order/${item.id}`)} />}
          initialNumToRender={10}
          windowSize={7}
          ListEmptyComponent={
            filter === "NEW"
              ? <Empty title="No new orders">New orders appear here with a sound. Keep notifications on.</Empty>
              : <Empty title="Nothing here" />
          }
        />
      )}
    </View>
  );
}
