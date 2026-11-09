import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Button, Card, Chip, Field, Label, Notice, Pill, s, Screen, Skeleton } from "@/components/ui";
import { forgetCached } from "@/lib/cache";
import { clock, minutesLeft, money, qty, STATUS_TEXT } from "@/lib/format";
import { C } from "@/lib/theme";
import { toast } from "@/lib/toast";

/** Bottom sheet with a note (and payment choice for pickups) before an action runs. */
function ActionSheet({ sheet, onClose, onRun }) {
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!sheet) return null;

  async function run() {
    if (sheet.noteRequired && !note.trim()) return setError(new Error("Add a short reason. The customer sees it."));
    setBusy(true); setError(null);
    try {
      await onRun({ note: note.trim() || undefined, paymentMethod: sheet.payment ? method : undefined, paymentReference: sheet.payment && reference.trim() ? reference.trim() : undefined });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(20,33,61,0.45)" }} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: C.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}>
        <Text style={[s.title, { fontSize: 20 }]}>{sheet.title}</Text>
        {sheet.description ? <Body muted style={{ marginBottom: 12 }}>{sheet.description}</Body> : null}
        {sheet.payment ? (
          <>
            <Label>How did the customer pay?</Label>
            <View style={[s.row, { marginBottom: 12 }]}>
              <Chip label="Cash" active={method === "CASH"} onPress={() => setMethod("CASH")} />
              <Chip label="GCash" active={method === "GCASH"} onPress={() => setMethod("GCASH")} />
            </View>
            {method === "GCASH" ? <Field label="GCash reference number" value={reference} onChangeText={setReference} /> : null}
          </>
        ) : null}
        {sheet.note !== false ? (
          <Field label={sheet.noteRequired ? "Reason" : "Note (optional)"} value={note} onChangeText={setNote} multiline maxLength={500} />
        ) : null}
        <Notice error={error} />
        <Button title={sheet.confirm} kind={sheet.danger ? "danger" : "primary"} onPress={run} busy={busy} />
        <Button title="Back" kind="secondary" onPress={onClose} style={{ marginTop: 8 }} />
      </SafeAreaView>
    </Modal>
  );
}

/** Pick what is short: for each item, how many the store actually has. */
function StockIssueSheet({ order, onClose, onRun }) {
  const [have, setHave] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!order) return null;

  const short = order.items
    .filter((i) => have[i.id] !== undefined && have[i.id] !== "" && Number(have[i.id]) < i.qty)
    .map((i) => ({ orderItemId: i.id, availableQty: Number(have[i.id]) }));

  async function run() {
    if (short.length === 0) return setError(new Error("Enter how many you have for at least one item (0 if none)."));
    if (short.some((x) => !Number.isFinite(x.availableQty) || x.availableQty < 0)) return setError(new Error("Quantities must be 0 or more."));
    setBusy(true); setError(null);
    try {
      await onRun(short);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal animationType="slide" visible onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>What is short?</Text>
          <Body muted style={{ marginBottom: 12 }}>
            Only fill in items you cannot give in full. The customer then accepts the smaller order or cancels.
          </Body>
          {order.items.map((i) => (
            <Card key={i.id}>
              <Text style={[s.body, { fontWeight: "700" }]}>{i.name}</Text>
              {i.choicesText ? <Text style={s.sub}>{i.choicesText}</Text> : null}
              {i.note ? <Text style={s.sub}>Note: {i.note}</Text> : null}
              <Text style={s.sub}>Ordered {qty(i.qty, i.stockUnit)}</Text>
              <Field label={i.stockUnit === "KG" ? "You have (kg)" : "You have"} keyboardType="decimal-pad" placeholder="Leave empty if complete"
                value={have[i.id] ?? ""} onChangeText={(v) => setHave({ ...have, [i.id]: v.replace(/[^0-9.]/g, "") })} />
            </Card>
          ))}
          <Notice error={error} />
          <Button title={`Send to customer (${short.length} short)`} kind="attention" onPress={run} busy={busy} />
          <Button title="Back" kind="secondary" onPress={onClose} style={{ marginTop: 8 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function OrderScreen() {
  const { orderId } = useLocalSearchParams();
  const { storeId, call, keyFor } = useStore();
  const { data, error, loading, reload } = useLoader(() => call(`/orders/${orderId}`), [storeId, orderId],
    { intervalMs: 20000, key: keyFor(`/orders/${orderId}`) });
  const [sheet, setSheet] = useState(null);
  const [stockSheet, setStockSheet] = useState(false);
  const [failure, setFailure] = useState(null);
  const [accepting, setAccepting] = useState(false);

  if (error && !data) return <Screen><Notice error={error} /></Screen>;
  if (!data) return <Screen><Skeleton kind="cards" rows={4} pad={0} what="Loading order" /></Screen>;

  const o = data.order;
  const left = o.status === "PENDING" ? minutesLeft(o.acceptBy) : null;
  const isPickup = o.fulfillmentType === "PICKUP";

  async function act(action, extra = {}) {
    await call(`/orders/${orderId}/actions`, { method: "POST", body: { action, ...extra } });
    forgetCached(`${storeId}|/orders?`); // order lists reload when you go back
    toast(`Order #${o.orderNumber}: ${STATUS_TEXT[{ ACCEPT: "PREPARING", REJECT: "CANCELLED", MARK_READY: "READY_FOR_PICKUP", MERCHANT_CANCEL: "CANCELLED", COMPLETE_PICKUP: "COMPLETED", REPORT_STOCK_ISSUE: "STOCK_ISSUE" }[action]]?.toLowerCase() || "updated"}.`);
    reload();
  }


  return (
    <Screen>
      <Stack.Screen options={{ title: `Order #${o.orderNumber}` }} />
      <Notice error={failure} />

      <Card tone={o.status === "PENDING" ? "attention" : undefined}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Pill tone={o.status === "CANCELLED" ? "stopped" : o.status === "COMPLETED" ? "done" : o.status === "PENDING" || o.status === "STOCK_ISSUE" ? "attention" : "active"}
            text={STATUS_TEXT[o.status] || o.status} />
          <Text style={s.sub}>Placed {clock(o.createdAt)}</Text>
        </View>
        <Text style={{ fontSize: 28, fontWeight: "800", color: C.ink, marginTop: 8 }}>{money(o.subtotal)}</Text>
        <Text style={s.sub}>Items total</Text>
        <Body>
          {isPickup ? "Pickup at the store" : o.deliveryService === "STANDARD" ? `Standard delivery${o.standardDepartureAt ? `, driver comes for the ${clock(o.standardDepartureAt)} run` : ""}` : "Express delivery, a driver comes as soon as it is ready"}
        </Body>
        {isPickup
          ? <Text style={[s.body, { fontWeight: "700", marginTop: 4 }]}>Collect {money(o.collectFromCustomer ?? o.subtotal)} from the customer ({o.paymentMethod === "GCASH" ? "GCash" : "cash"})</Text>
          : <Body muted>The driver collects payment from the customer ({o.paymentMethod === "GCASH" ? "GCash" : "cash"}).</Body>}
        {o.status === "PENDING" && left !== null ? (
          <Text style={[s.body, { fontWeight: "700", color: C.mangoInk, marginTop: 6 }]}>
            {left === 0 ? "Accept now or it is cancelled." : `Accept within ${left} min or it is cancelled automatically.`}
          </Text>
        ) : null}
        {o.status === "STOCK_ISSUE" ? <Body style={{ marginTop: 6 }}>Waiting for the customer to accept the changes or cancel.</Body> : null}
        {o.status === "READY_FOR_PICKUP" && !isPickup ? <Body style={{ marginTop: 6 }}>Waiting for the driver to pick it up.</Body> : null}
      </Card>

      {o.status === "PENDING" ? (
        <View style={{ marginBottom: 12 }}>
          <Button title="Accept and start preparing" busy={accepting} onPress={async () => {
            setAccepting(true); setFailure(null);
            try { await act("ACCEPT"); } catch (e) { setFailure(e); } finally { setAccepting(false); }
          }} />
          <Button title="Decline order" kind="danger" style={{ marginTop: 8 }}
            onPress={() => setSheet({ title: "Decline this order?", description: "The customer is told the store declined it.", confirm: "Decline order", danger: true, noteRequired: true, run: (v) => act("REJECT", v) })} />
        </View>
      ) : null}

      {["PREPARING", "CONFIRMED"].includes(o.status) ? (
        <View style={{ marginBottom: 12 }}>
          <Button title={isPickup ? "Ready for pickup" : "Ready for the driver"} onPress={() => setSheet({ title: isPickup ? "Ready for pickup?" : "Ready for the driver?", description: isPickup ? "The customer is told to come to the store." : "The driver is told it is ready.", confirm: "Mark ready", note: false, run: () => act("MARK_READY") })} />
          <Button title="Some items are short" kind="attention" style={{ marginTop: 8 }} onPress={() => setStockSheet(true)} />
          <Button title="Cancel order" kind="danger" style={{ marginTop: 8 }}
            onPress={() => setSheet({ title: "Cancel this order?", description: "Only when you cannot fill it at all.", confirm: "Cancel order", danger: true, noteRequired: true, run: (v) => act("MERCHANT_CANCEL", v) })} />
        </View>
      ) : null}

      {o.status === "READY_FOR_PICKUP" && isPickup ? (
        <View style={{ marginBottom: 12 }}>
          <Button title="Customer picked it up and paid" onPress={() => setSheet({ title: "Complete pickup", confirm: "Complete", payment: true, note: false, run: (v) => act("COMPLETE_PICKUP", v) })} />
        </View>
      ) : null}

      {["STOCK_ISSUE", "READY_FOR_PICKUP"].includes(o.status) ? (
        <Button title="Cancel order" kind="danger" style={{ marginBottom: 12 }}
          onPress={() => setSheet({ title: "Cancel this order?", confirm: "Cancel order", danger: true, noteRequired: true, run: (v) => act("MERCHANT_CANCEL", v) })} />
      ) : null}

      {o.posItemCount > 0 && ["PENDING", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"].includes(o.status) ? (
        <Card tone="attention">
          <Label>Ring it up in Hatid POS</Label>
          <Body>
            Scan the {o.posItemCount === o.items.length ? "items" : `${o.posItemCount} POS item${o.posItemCount === 1 ? "" : "s"}`} in Hatid POS
            as a sale and put the receipt in the bag. The POS stock goes down and Sentroh updates within a minute.
            {o.posItemCount < o.items.length ? " Items marked \"Sentroh only\" are not in the POS; Sentroh counts their stock." : ""}
          </Body>
        </Card>
      ) : null}

      <Card>
        <Label>Items</Label>
        {o.items.map((i) => (
          <View key={i.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={[s.body, { flex: 1, fontWeight: "600" }]}>{qty(i.qty, i.stockUnit)} {i.name}</Text>
              <Text style={s.body}>{money(i.lineTotal)}</Text>
            </View>
            {o.posItemCount > 0 && i.fromPos === false ? <Text style={[s.sub, { color: C.teal, fontWeight: "600" }]}>Sentroh only (not in POS)</Text> : null}
            {i.choicesText ? <Text style={[s.body, { color: C.inkSoft }]}>{i.choicesText}</Text> : null}
            {i.note ? <Text style={[s.body, { color: C.mangoInk, fontWeight: "600" }]}>Note: {i.note}</Text> : null}
            {i.availableQty != null && i.availableQty < i.qty ? <Text style={[s.sub, { color: C.mangoInk }]}>You have {i.availableQty}</Text> : null}
          </View>
        ))}
        <View style={{ marginTop: 8 }}>
          <Row label="Items" value={money(o.subtotal)} />
          <Row label="Sentroh commission" value={o.commissionAmount > 0 ? `− ${money(o.commissionAmount)}` : money(0)} />
          <Row label="You earn" value={money(o.earnings ?? (o.subtotal || 0) - (o.commissionAmount || 0))} bold />
          <Text style={[s.sub, { marginTop: 4 }]}>
            {isPickup
              ? "The customer pays you at pickup. The commission comes out of your deposit."
              : "Sentroh sends your earnings in the weekly payout."}
          </Text>
        </View>
      </Card>

      <Card>
        <Label>Customer</Label>
        <Body>{o.customerName}</Body>
        {o.customerPhone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${o.customerPhone}`)}><Text style={[s.body, { color: C.teal, fontWeight: "600" }]}>Call {o.customerPhone}</Text></Pressable>
        ) : null}
        {!isPickup ? (
          <Body muted style={{ marginTop: 6 }}>
            The driver has the address and contacts the customer{o.deliveryDistanceKm != null ? ` (${Number(o.deliveryDistanceKm).toFixed(1)} km away)` : ""}.
          </Body>
        ) : null}
        {o.notes ? <Body style={{ marginTop: 6 }}>Note: {o.notes}</Body> : null}
      </Card>

      <ActionSheet key={sheet?.title || "none"} sheet={sheet} onClose={() => setSheet(null)} onRun={(v) => (sheet?.run ? sheet.run(v) : Promise.resolve())} />
      {stockSheet ? (
        <StockIssueSheet order={o} onClose={() => setStockSheet(false)} onRun={(items) => act("REPORT_STOCK_ISSUE", { items })} />
      ) : null}
    </Screen>
  );
}

function Row({ label, value, bold }) {
  return (
    <View style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
      <Text style={[s.body, bold && { fontWeight: "800" }]}>{label}</Text>
      <Text style={[s.body, bold && { fontWeight: "800" }]}>{value}</Text>
    </View>
  );
}
