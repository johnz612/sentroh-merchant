import { useState } from "react";
import { Text, View } from "react-native";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Card, Chip, Label, Loading, Notice, Pill, Screen, s } from "@/components/ui";
import { money } from "@/lib/format";
import { C } from "@/lib/theme";

const PERIODS = [["TODAY", "Today"], ["YESTERDAY", "Yesterday"], ["THIS_WEEK", "This week"], ["LAST_WEEK", "Last week"]];
const METHOD = { GCASH: "GCash", BANK: "Bank", CASH: "Cash" };

const day = (v) => (v ? new Date(v).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" }) : "");
const time = (v) => (v ? new Date(v).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "");

function Line({ label, value, strong, minus }) {
  return (
    <View style={[s.row, { justifyContent: "space-between", paddingVertical: 3 }]}>
      <Text style={[s.body, strong && { fontWeight: "700" }]}>{label}</Text>
      <Text style={[s.body, strong && { fontWeight: "700" }, minus && { color: C.red }]}>{minus ? "− " : ""}{money(value)}</Text>
    </View>
  );
}

export default function Earnings() {
  const { storeId, call, canEdit } = useStore();
  const [period, setPeriod] = useState("TODAY");
  const { data, error } = useLoader(
    () => (canEdit ? call("/earnings", { query: { period } }) : Promise.resolve(null)),
    [storeId, period, canEdit],
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
    return <Screen edges={[]}>{chips}{error ? <Notice error={error} /> : <Loading what="Loading earnings" />}</Screen>;
  }

  const { totals, pickup, delivery, owedBySentroh: owed, payouts, orders } = data;

  return (
    <Screen edges={[]}>
      {chips}

      <Card>
        <Label>{totals.orders} completed order{totals.orders === 1 ? "" : "s"}</Label>
        <Line label="Item sales" value={totals.itemSales} />
        <Line label="Sentroh commission" value={totals.commission} minus />
        <Line label="You earn" value={totals.earnings} strong />
        {totals.cancelledOrders ? <Text style={[s.sub, { marginTop: 6 }]}>{totals.cancelledOrders} cancelled (not counted).</Text> : null}
      </Card>

      <Card>
        <Label>Where the money is</Label>
        <Line label={`Pickup: collected at your store (${pickup.orders})`} value={pickup.collectedByStore} />
        <Text style={s.sub}>Commission on pickup ({money(pickup.commission)}) comes from your deposit.</Text>
        <View style={{ height: 8 }} />
        <Line label={`Delivery: Sentroh pays you (${delivery.orders})`} value={delivery.paidBySentroh} />
        <Text style={s.sub}>The driver collects from the customer. Sentroh pays you items minus commission every week.</Text>
      </Card>

      <Card tone={owed.nextPayout > 0 ? "attention" : undefined}>
        <Label>Next weekly payout</Label>
        <Body>{money(owed.nextPayout)} for {owed.nextPayoutOrders} delivery order{owed.nextPayoutOrders === 1 ? "" : "s"} up to {day(new Date(new Date(owed.nextPayoutCovers).getTime() - 1))}</Body>
        <Text style={s.sub}>
          Sentroh still owes {money(owed.total)} in all ({owed.orders} order{owed.orders === 1 ? "" : "s"}). Orders from this week go into next week's payout.
        </Text>
      </Card>

      <Card>
        <Label>Payouts received</Label>
        {payouts.length === 0 ? <Body>No payouts yet.</Body> : payouts.map((p) => (
          <View key={p.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#ECEFF0" }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={[s.body, { fontWeight: "700" }]}>{money(p.amount)}</Text>
              <Text style={s.sub}>{day(p.paidAt)} · {METHOD[p.method] || p.method}</Text>
            </View>
            <Text style={s.sub}>
              {p.orderCount} orders up to {day(new Date(new Date(p.periodEnd).getTime() - 1))}: {money(p.itemSales)} items − {money(p.commission)} commission
              {p.reference ? ` · Ref ${p.reference}` : ""}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <Label>Orders</Label>
        {orders.length === 0 ? <Body>No completed orders in this period.</Body> : orders.map((o) => (
          <View key={o.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#ECEFF0" }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={[s.body, { fontWeight: "600" }]}>#{o.orderNumber}</Text>
              <Text style={[s.body, { fontWeight: "700" }]}>{money(o.earnings)}</Text>
            </View>
            <View style={[s.row, { justifyContent: "space-between", marginTop: 2 }]}>
              <Text style={s.sub}>{time(o.completedAt)} · {money(o.itemSales)} − {money(o.commission)}</Text>
              {o.fulfillmentType === "PICKUP"
                ? <Pill text="Pickup" tone="muted" />
                : <Pill text={o.paidOut ? "Paid out" : "Payout pending"} tone={o.paidOut ? "done" : "attention"} />}
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
