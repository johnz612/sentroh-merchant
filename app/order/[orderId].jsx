import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/AppText";
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
  const router = useRouter();
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

  // Shared trip: Accept and Ready cover both orders at once (one driver takes both).
  const partner = data.order.sharedWith;
  async function act(action, extra = {}) {
    if (partner && (action === "ACCEPT" || action === "MARK_READY")) {
      await call(`/shared-trips/${partner.tripId}/actions`, { method: "POST", body: { action, orderId } });
      forgetCached(`${storeId}|/orders?`);
      toast(`Orders #${o.orderNumber} and #${partner.orderNumber}: ${action === "ACCEPT" ? "accepted" : "ready for the driver"}.`);
      reload();
      return;
    }
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
          <Text style={s.sub}>Placed {clock(o.createdAt)}{o.orderCode ? ` · ${o.orderCode}` : ""}</Text>
        </View>
        <Text style={{ fontSize: 28, fontWeight: "800", color: C.ink, marginTop: 8 }}>{money(o.subtotal)}</Text>
        <Text style={s.sub}>Items total</Text>
        <Body>
          {isPickup ? "Pickup at the store" : o.deliveryService === "STANDARD" ? `Standard delivery${o.standardDepartureAt ? `, driver comes for the ${clock(o.standardDepartureAt)} run` : ""}` : "Express delivery, a driver comes as soon as it is ready"}
        </Body>
        {o.sharedTrip && !partner ? (
          <Body muted>Shared trip: a neighbour's order from your store goes with the same driver. Have both ready together.</Body>
        ) : null}
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

      {partner ? (
        <Card tone="attention">
          <Text style={[s.body, { fontWeight: "800" }]}>Shared trip · 2 orders, 1 driver</Text>
          <Body>This order goes with order #{partner.orderNumber} ({(STATUS_TEXT[partner.status] || partner.status).toLowerCase()}). Accept and Ready below cover both.</Body>
          <Text onPress={() => router.push(`/order/${partner.orderId}`)} accessibilityRole="link"
            style={[s.body, { fontWeight: "700", textDecorationLine: "underline", marginTop: 4 }]}>Open order #{partner.orderNumber}</Text>
        </Card>
      ) : null}

      {o.status === "PENDING" ? (
        <View style={{ marginBottom: 12 }}>
          <Button title={partner ? `Accept both orders (#${o.orderNumber} + #${partner.orderNumber})` : "Accept and start preparing"} busy={accepting} onPress={async () => {
            setAccepting(true); setFailure(null);
            try { await act("ACCEPT"); } catch (e) { setFailure(e); } finally { setAccepting(false); }
          }} />
          <Button title="Decline order" kind="danger" style={{ marginTop: 8 }}
            onPress={() => setSheet({ title: "Decline this order?", description: "The customer is told the store declined it.", confirm: "Decline order", danger: true, noteRequired: true, run: (v) => act("REJECT", v) })} />
        </View>
      ) : null}

      {["PREPARING", "CONFIRMED"].includes(o.status) ? (
        <View style={{ marginBottom: 12 }}>
          <Button title={partner ? "Both ready for the driver" : isPickup ? "Ready for pickup" : "Ready for the driver"} onPress={() => setSheet({
            title: partner ? "Both orders ready?" : isPickup ? "Ready for pickup?" : "Ready for the driver?",
            description: partner ? `Orders #${o.orderNumber} and #${partner.orderNumber} are packed and ready. The driver is told.` : isPickup ? "The customer is told to come to the store." : "The driver is told it is ready.",
            confirm: partner ? "Mark both ready" : "Mark ready", note: false, run: () => act("MARK_READY") })} />
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
            {o.posItemCount > 0 && i.fromPos === false ? <Text style={[s.sub, { color: C.ink, fontWeight: "700", textDecorationLine: "underline" }]}>Sentroh only (not in POS)</Text> : null}
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
              ? o.commissionAmount > 0
                ? "The customer pays you at pickup. The commission comes out of your deposit."
                : "The customer pays you at pickup. No Sentroh commission on this order."
              : "Sentroh sends your earnings in the weekly payout."}
          </Text>
        </View>
      </Card>

      <Card>
        <Label>Customer</Label>
        <Body>{o.customerName}</Body>
        {!isPickup ? (
          <Body muted style={{ marginTop: 6 }}>
            The driver has the address and contacts the customer{o.deliveryDistanceKm != null ? ` (${Number(o.deliveryDistanceKm).toFixed(1)} km away)` : ""}.
          </Body>
        ) : null}
        {o.notes ? <Body style={{ marginTop: 6 }}>Note: {o.notes}</Body> : null}
      </Card>

      <Messages order={o} onSend={async (key) => {
        await call(`/orders/${orderId}/messages`, { method: "POST", body: { key } });
        toast("Message sent to the customer.");
        reload();
      }} />

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

const STORE_MESSAGES = [
  ["READY", "Ready, please pick it up"],
  ["LATE", "We're a few minutes late"],
  ["CHECK_APP", "Please check your order in the app"],
  ["CLOSING_SOON", "We're closing soon"],
];
const BEING_MADE = ["PENDING", "CONFIRMED", "PREPARING", "STOCK_ISSUE"];

/**
 * Messages that fit the order now (same rule as the server, orderMessageRules.js): "Ready,
 * please pick it up" only for pickup; delivery orders only until the driver has them.
 */
function messageKeys(order) {
  if (order.fulfillmentType === "PICKUP") {
    if (BEING_MADE.includes(order.status)) return ["READY", "LATE", "CHECK_APP", "CLOSING_SOON"];
    if (order.status === "READY_FOR_PICKUP") return ["READY", "CHECK_APP", "CLOSING_SOON"];
    return [];
  }
  return BEING_MADE.includes(order.status) || order.status === "READY_FOR_PICKUP" ? ["LATE", "CHECK_APP"] : [];
}

/**
 * Fixed messages with the customer (no phone numbers either way, so orders stay on Sentroh).
 * Sentroh support sees them too.
 */
function Messages({ order, onSend }) {
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);
  const keys = messageKeys(order);
  const open = keys.length > 0;
  const list = order.messages || [];
  if (!open && list.length === 0) return null;

  async function send(key) {
    setBusy(key); setFailure(null);
    try { await onSend(key); } catch (err) { setFailure(err); } finally { setBusy(null); }
  }

  return (
    <Card>
      <Label>Messages with the customer</Label>
      {list.map((m) => (
        <View key={m.id} style={{ marginTop: 6, alignSelf: m.from === "STORE" ? "flex-end" : "flex-start", maxWidth: "85%",
          backgroundColor: m.from === "STORE" ? C.mangoWash : C.soft, borderRadius: 12, padding: 8 }}>
          <Text style={s.body}>{m.body}</Text>
          <Text style={s.sub}>{m.from === "STORE" ? "You" : "Customer"} · {clock(m.createdAt)}</Text>
        </View>
      ))}
      {open ? (
        <>
          <Text style={[s.sub, { marginTop: list.length ? 10 : 2 }]}>Send a message (the customer gets a notification):</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
            {STORE_MESSAGES.filter(([key]) => keys.includes(key)).map(([key, text]) => (
              <Pressable key={key} disabled={!!busy} onPress={() => send(key)}
                style={{ borderWidth: 1, borderColor: C.teal, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginTop: 6, opacity: busy && busy !== key ? 0.5 : 1 }}>
                <Text style={{ color: C.ink, fontWeight: "700", textDecorationLine: "underline" }}>{busy === key ? "Sending…" : text}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <Text style={[s.sub, { marginTop: 8 }]}>
          {order.status === "OUT_FOR_DELIVERY" ? "The driver has the order now, so messages are closed." : "This order is finished, so messages are closed."}
        </Text>
      )}
      <Notice error={failure} />
    </Card>
  );
}
