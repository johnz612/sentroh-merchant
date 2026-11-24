import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/AppText";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Card, Chip, Label, Notice, Pill, s, Screen, Skeleton } from "@/components/ui";
import { money } from "@/lib/format";
import { C } from "@/lib/theme";

const PERIODS = [["TODAY", "Today"], ["YESTERDAY", "Yesterday"], ["THIS_WEEK", "This week"], ["LAST_WEEK", "Last week"]];
const METHOD = { GCASH: "GCash", BANK: "Bank", CASH: "Cash" };

const day = (v) => (v ? new Date(v).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" }) : "");
const time = (v) => (v ? new Date(v).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "");

export default function Earnings() {
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
          <View key={o.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={[s.body, { fontWeight: "700" }]}>#{o.orderNumber}</Text>
              <Text style={[s.body, { fontWeight: "700" }]}>{money(o.earnings)}</Text>
            </View>
            <View style={[s.row, { justifyContent: "space-between", marginTop: 2 }]}>
              <Text style={s.sub}>{time(o.completedAt)} · {o.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"}</Text>
              {o.fulfillmentType === "PICKUP"
                ? <Pill text="Cash at store" tone="muted" />
                : <Pill text={o.paidOut ? "Paid" : "Not paid yet"} tone={o.paidOut ? "done" : "attention"} />}
            </View>
          </View>
        ))}
      </Card>

      {payouts.length > 0 ? (
        <Card>
          <Label>Payouts received</Label>
          {payouts.map((p) => (
            <View key={p.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text style={[s.body, { fontWeight: "700" }]}>{money(p.amount)}</Text>
                <Text style={s.sub}>{day(p.paidAt)} · {METHOD[p.method] || p.method}</Text>
              </View>
              <Text style={s.sub}>
                {p.orderCount} order{p.orderCount === 1 ? "" : "s"} up to {upTo(p.periodEnd)}{p.reference ? ` · Ref ${p.reference}` : ""}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
