import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "@/components/AppText";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Card, Chip, Label, Notice, Pill, s, Screen, Skeleton } from "@/components/ui";
import { money } from "@/lib/format";
import { C } from "@/lib/theme";

const PERIODS = [["TODAY", "Today"], ["YESTERDAY", "Yesterday"], ["THIS_WEEK", "This week"], ["LAST_WEEK", "Last week"]];
const METHOD = { GCASH: "GCash", BANK: "Bank", CASH: "Cash" };

const day = (v) => (v ? new Date(v).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" }) : "");
const weekday = (v) => (v ? new Date(v).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" }) : "");
const time = (v) => (v ? new Date(v).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "");

/** Unpaid delivery orders grouped by the Monday they are due. */
function dueGroups(orders) {
  const groups = new Map();
  for (const o of orders) {
    if (!groups.has(o.dueOn)) groups.set(o.dueOn, { dueOn: o.dueOn, orders: [], amount: 0 });
    const g = groups.get(o.dueOn);
    g.orders.push(o);
    g.amount = Math.round((g.amount + o.paidBySentroh) * 100) / 100;
  }
  return [...groups.values()];
}

/** The tag on an order row: how this order's money reached (or will reach) the store. */
function SettlementTag({ o }) {
  if (o.settlement === "AT_STORE") return <Pill text="Cash at store" tone="muted" />;
  if (o.settlement === "PAID") return <Pill text={`Paid ${day(o.payout?.paidAt)}`} tone="done" />;
  const late = o.dueOn && new Date(o.dueOn).getTime() + 3 * 86400000 < Date.now();
  return <Pill text={late ? `Late · due ${day(o.dueOn)}` : `Due ${day(o.dueOn)}`} tone={late ? "stopped" : "attention"} />;
}

export default function Earnings() {
  const router = useRouter();
  const { storeId, call, canEdit, keyFor } = useStore();
  const [period, setPeriod] = useState("TODAY");
  const { data, error } = useLoader(
    () => (canEdit ? call("/earnings", { query: { period } }) : Promise.resolve(null)),
    [storeId, period, canEdit],
    { key: canEdit ? keyFor("/earnings", { period }) : undefined },
  );

  if (!canEdit) {
    return <Screen edges={[]}><Notice kind="info">Only the owner or a manager can see earnings.</Notice></Screen>;
  }

  const chips = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
      {PERIODS.map(([key, label]) => (
        <View key={key} style={{ marginBottom: 8 }}>
          <Chip label={label} active={period === key} onPress={() => setPeriod(key)} />
        </View>
      ))}
    </View>
  );

  if (!data || data.period?.key !== period) {
    return <Screen edges={[]}>{chips}{error ? <Notice error={error} /> : <Skeleton kind="cards" rows={4} pad={0} what="Loading earnings" />}</Screen>;
  }

  const { totals, pickup, owedBySentroh: owed, payouts, orders } = data;
  const periodName = PERIODS.find(([k]) => k === period)[1].toLowerCase();
  const upTo = (v) => day(new Date(new Date(v).getTime() - 1));

  return (
    <Screen edges={[]}>
      {chips}

      {/* 1. What you earned: one big number. */}
      <View style={{ backgroundColor: C.ink, borderRadius: 16, padding: 18, marginBottom: 12 }}>
        <Text style={{ color: "#D6D6D2", fontSize: 14, fontWeight: "600" }}>You earned {periodName}</Text>
        <Text style={{ color: "#fff", fontSize: 36, fontWeight: "800", marginTop: 2 }}>{money(totals.earnings)}</Text>
        <Text style={{ color: "#D6D6D2", fontSize: 13, marginTop: 4 }}>
          {totals.orders} order{totals.orders === 1 ? "" : "s"} · {money(totals.itemSales)} sales − {money(totals.commission)} Sentroh fee
        </Text>
        {totals.cancelledOrders ? <Text style={{ color: "#D6D6D2", fontSize: 13, marginTop: 2 }}>{totals.cancelledOrders} cancelled, not counted.</Text> : null}
      </View>

      {/* 2. What Sentroh still has to pay you. */}
      <Card tone={owed.total > 0 ? "attention" : undefined}>
        <Label>Sentroh will pay you</Label>
        <Text style={{ fontSize: 28, fontWeight: "800", color: C.ink }}>{money(owed.total)}</Text>
        <Text style={[s.sub, { marginTop: 4 }]}>
          {owed.total > 0
            ? owed.nextPayout > 0
              ? `${money(owed.nextPayout)} comes in the next weekly payout (orders up to ${upTo(owed.nextPayoutCovers)}). The rest comes the week after.`
              : "Paid every week. This week's orders come in next week's payout."
            : "Nothing waiting. You're all paid."}
        </Text>
        {dueGroups(owed.unpaidOrders || []).map((g) => (
          <View key={g.dueOn} style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3D36B" }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={[s.body, { fontWeight: "700" }]}>Due {weekday(g.dueOn)}</Text>
              <Text style={[s.body, { fontWeight: "700" }]}>{money(g.amount)}</Text>
            </View>
            <Text style={s.sub}>{g.orders.length} order{g.orders.length === 1 ? "" : "s"}: {g.orders.map((o) => `#${o.orderNumber}`).join(", ")}</Text>
          </View>
        ))}
      </Card>

      {/* 3. Pickup cash, only when there was any. */}
      {pickup.orders > 0 ? (
        <Card>
          <Label>Pickup orders</Label>
          <Body>You already got {money(pickup.collectedByStore)} at your store ({pickup.orders} order{pickup.orders === 1 ? "" : "s"}).</Body>
          <Text style={[s.sub, { marginTop: 2 }]}>Sentroh's fee for these ({money(pickup.commission)}) is taken from your deposit.</Text>
        </Card>
      ) : null}

      <Card>
        <Label>Orders</Label>
        {orders.length === 0 ? <Body muted>No completed orders {periodName}.</Body> : orders.map((o) => (
          <Pressable key={o.id} disabled={!o.payout} onPress={() => router.push(`/payout/${o.payout.id}`)}
            accessibilityRole={o.payout ? "button" : undefined}
            style={({ pressed }) => [{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }, pressed && { opacity: 0.6 }]}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={[s.body, { fontWeight: "700" }]}>#{o.orderNumber}</Text>
              <Text style={[s.body, { fontWeight: "700" }]}>{money(o.earnings)}</Text>
            </View>
            <View style={[s.row, { justifyContent: "space-between", marginTop: 2 }]}>
              <Text style={s.sub}>{period === "TODAY" ? time(o.completedAt) : `${day(o.completedAt)}, ${time(o.completedAt)}`} · {o.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"}</Text>
              <SettlementTag o={o} />
            </View>
            {o.payout ? (
              <Text style={[s.sub, { marginTop: 2 }]}>{METHOD[o.payout.method] || o.payout.method} · Ref {o.payout.reference} · See payout ›</Text>
            ) : null}
          </Pressable>
        ))}
      </Card>

      {payouts.length > 0 ? (
        <Card>
          <Label>Payouts received</Label>
          <Text style={[s.sub, { marginBottom: 4 }]}>Tap a payout to see every order it paid.</Text>
          {payouts.map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/payout/${p.id}`)} accessibilityRole="button"
              style={({ pressed }) => [{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }, pressed && { opacity: 0.6 }]}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text style={[s.body, { fontWeight: "700" }]}>{money(p.amount)}</Text>
                <Text style={s.sub}>{day(p.paidAt)} · {METHOD[p.method] || p.method}</Text>
              </View>
              <Text style={s.sub}>
                {p.orderCount} order{p.orderCount === 1 ? "" : "s"} up to {upTo(p.periodEnd)}{p.reference ? ` · Ref ${p.reference}` : ""} ›
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
