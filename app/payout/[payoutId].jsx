import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/AppText";

import { useLoader, useStore } from "@/components/hooks";
import { Card, Label, Notice, s, Screen, Skeleton } from "@/components/ui";
import { money } from "@/lib/format";
import { C } from "@/lib/theme";

const METHOD = { GCASH: "GCash", BANK: "Bank transfer", CASH: "Cash" };
const date = (v, opts) => (v ? new Date(v).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", ...opts }) : "");
const long = (v) => date(v, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
const short = (v) => date(v, { month: "short", day: "numeric" });

function Row({ label, value, strong, minus }) {
  return (
    <View style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
      <Text style={[s.body, strong && { fontWeight: "800" }]}>{label}</Text>
      <Text style={[s.body, strong && { fontWeight: "800" }]}>{minus ? "− " : ""}{money(value)}</Text>
    </View>
  );
}

/** One payout and every order it paid: the store can check it line by line. */
export default function PayoutScreen() {
  const { payoutId } = useLocalSearchParams();
  const { storeId, call, keyFor } = useStore();
  const { data, error } = useLoader(() => call(`/payouts/${payoutId}`), [storeId, payoutId], { key: keyFor(`/payouts/${payoutId}`) });

  if (!data) return <Screen edges={[]}>{error ? <Notice error={error} /> : <Skeleton kind="cards" rows={3} pad={0} what="Loading payout" />}</Screen>;

  const { payout: p, orders, totals } = data;
  const periodEnd = new Date(new Date(p.periodEnd).getTime() - 1);

  return (
    <Screen edges={[]}>
      <View style={{ backgroundColor: C.ink, borderRadius: 16, padding: 18, marginBottom: 12 }}>
        <Text style={{ color: "#D6D6D2", fontSize: 14, fontWeight: "600" }}>Sentroh paid you</Text>
        <Text style={{ color: "#fff", fontSize: 36, fontWeight: "800", marginTop: 2 }}>{money(p.amount)}</Text>
        <Text style={{ color: C.mango, fontSize: 15, fontWeight: "700", marginTop: 4 }}>{long(p.paidAt)}</Text>
        <Text style={{ color: "#D6D6D2", fontSize: 14, marginTop: 2 }}>{METHOD[p.method] || p.method} · Reference {p.reference}</Text>
      </View>

      <Card>
        <Label>What this payout covers</Label>
        <Text style={[s.sub, { marginBottom: 6 }]}>
          {p.orderCount} delivery order{p.orderCount === 1 ? "" : "s"} completed up to {short(periodEnd)}.
        </Text>
        <Row label="Item sales" value={totals.itemSales} />
        <Row label="Sentroh fee" value={totals.commission} minus />
        <View style={{ height: 1, backgroundColor: C.line, marginVertical: 6 }} />
        <Row label="Paid to you" value={p.amount} strong />
        {p.note ? <Text style={[s.sub, { marginTop: 6 }]}>Note: {p.note}</Text> : null}
      </Card>

      <Card>
        <Label>Orders in this payout ({orders.length})</Label>
        {orders.map((o) => (
          <View key={o.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={[s.body, { fontWeight: "700" }]}>#{o.orderNumber}</Text>
              <Text style={[s.body, { fontWeight: "700" }]}>{money(o.earnings)}</Text>
            </View>
            <Text style={s.sub}>{short(o.completedAt)} · {money(o.itemSales)} sales − {money(o.commission)} fee</Text>
          </View>
        ))}
      </Card>

      <Text style={[s.sub, { paddingHorizontal: 4 }]}>
        Every delivery order is in exactly one payout. Orders not listed in any payout are still unpaid and show "Due" on the Earnings page.
        Questions about this payout? Message Sentroh with reference {p.reference}.
      </Text>
    </Screen>
  );
}
