import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Button, Card, Chip, Label, Notice, s, Screen, Skeleton } from "@/components/ui";
import { forgetCached } from "@/lib/cache";
import { toast } from "@/lib/toast";
import { clock, money } from "@/lib/format";
import { unregisterPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";

const PAUSES = [["30", "30 min"], ["60", "1 hour"], ["120", "2 hours"], ["END_OF_DAY", "Rest of today"]];

function takingOrdersText(branch) {
  const now = branch?.now;
  if (branch?.ordersPausedUntil) return { tone: "attention", text: `Paused until ${clock(branch.ordersPausedUntil)}` };
  if (!now?.hasHours) return { tone: "danger", text: "No store hours yet. Customers cannot order." };
  if (now.acceptingOrders && (now.isOpenAllDay || !now.lastOrderAt)) return { tone: undefined, text: "Open 24 hours today. Taking orders." };
  if (now.acceptingOrders) return { tone: undefined, text: `Taking orders until ${clock(now.lastOrderAt)}` };
  if (now.isOpen) return { tone: "attention", text: `Last orders were at ${clock(now.lastOrderAt)}. Closing ${clock(now.closesAt)}.` };
  return { tone: "attention", text: now.nextOpensAt ? `Closed. Orders open again ${clock(now.nextOpensAt)}.` : "Closed." };
}

export default function Store() {
  const router = useRouter();
  const { storeId, call, canEdit, keyFor } = useStore();
  const stores = useSession((st) => st.stores);
  const selectStore = useSession((st) => st.selectStore);
  const phone = useSession((st) => st.phone);
  const { data, error, reload } = useLoader(() => call("/store"), [storeId], { intervalMs: 60000, key: keyFor("/store") });
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);

  if (!data) return <Screen>{error ? <Notice error={error} /> : <Skeleton kind="cards" rows={4} pad={0} what="Loading store" />}</Screen>;

  const { merchant, branch, deposit, role } = data;
  const status = takingOrdersText(branch);

  async function settings(body, key) {
    setBusy(key); setFailure(null);
    try {
      await call(`/branches/${branch.id}/settings`, { method: "PATCH", body });
      await reload();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(null);
    }
  }

  /** What new products start as: COOKED_FOOD or GOODS. */
  async function setDefaultKind(kind) {
    setBusy(`KIND${kind}`); setFailure(null);
    try {
      await call("/store", { method: "PATCH", body: { defaultProductKind: kind } });
      forgetCached(`${storeId}|/store`);
      await reload();
      toast(kind === "COOKED_FOOD" ? "New products now start as cooked food." : "New products now start as packaged items.");
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    await unregisterPush();
    await supabase.auth.signOut();
  }

  return (
    <Screen edges={[]}>
      <Text style={s.title}>{merchant.name}</Text>
      <Text style={[s.sub, { marginBottom: 12 }]}>
        {role === "OWNER" ? "Owner" : role === "MANAGER" ? "Manager" : "Staff"}, signed in as {phone}
      </Text>

      {merchant.status === "PENDING" ? (
        <Card tone="attention">
          <Label>Waiting for Sentroh approval</Label>
          <Body>Customers can't see your store yet. Meanwhile, set your store hours and add your products. Sentroh will call you.</Body>
        </Card>
      ) : null}

      <Card tone={status.tone}>
        <Label>Orders</Label>
        <Body>{status.text}</Body>
        {branch?.ordersPausedUntil ? (
          <Button title="Resume orders now" style={{ marginTop: 10 }} busy={busy === "RESUME"} disabled={!canEdit} onPress={() => settings({ pause: "RESUME" }, "RESUME")} />
        ) : (
          <>
            <Text style={[s.sub, { marginTop: 10, marginBottom: 6 }]}>Too busy? Pause new orders for:</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {PAUSES.map(([value, label]) => (
                <View key={value} style={{ marginBottom: 8 }}>
                  <Chip label={busy === value ? "Pausing…" : label} onPress={() => canEdit && settings({ pause: value }, value)} />
                </View>
              ))}
            </View>
          </>
        )}
        <View style={[s.row, { justifyContent: "space-between", marginTop: 8 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[s.body, { fontWeight: "600" }]}>Accept orders automatically</Text>
            <Text style={s.sub}>New orders go straight to preparing. You still get an alert.</Text>
          </View>
          <Switch value={branch?.acceptOrdersAutomatically === true} disabled={!canEdit || busy === "AUTO"}
            onValueChange={(v) => settings({ acceptOrdersAutomatically: v }, "AUTO")}
            trackColor={{ true: C.teal, false: "#C8D1CE" }} thumbColor="#fff" />
        </View>
        {(merchant.defaultProductKind === "COOKED_FOOD" || merchant.merchantType === "FOOD_RESTAURANT") && branch ? (
          <View style={{ marginTop: 12 }}>
            <Text style={[s.body, { fontWeight: "600" }]}>Usual preparing time: {branch.prepMinutes ?? 20} min</Text>
            <Text style={s.sub}>For cooked food. Customers see it as an estimate; a dish can have its own time.</Text>
            <View style={[s.row, { flexWrap: "wrap", marginTop: 6 }]}>
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <View key={m} style={{ marginBottom: 6 }}>
                  <Chip label={busy === `PREP${m}` ? "Saving…" : `${m} min`} active={(branch.prepMinutes ?? 20) === m}
                    onPress={() => canEdit && settings({ prepMinutes: m }, `PREP${m}`)} />
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {!canEdit ? <Text style={[s.sub, { marginTop: 8 }]}>Only the owner or a manager can change these.</Text> : null}
      </Card>
      <Notice error={failure} />

      <Card>
        <Label>New products start as</Label>
        <Text style={[s.sub, { marginBottom: 6 }]}>
          You can still choose for each product. Cooked food is delivered by Express only and needs a photo and a menu section before it can be on sale.
        </Text>
        <View style={s.row}>
          {[["COOKED_FOOD", "Cooked food"], ["GOODS", "Packaged item"]].map(([kind, label]) => (
            <Chip key={kind} label={busy === `KIND${kind}` ? "Saving…" : label} active={merchant.defaultProductKind === kind}
              onPress={() => canEdit && merchant.defaultProductKind !== kind && setDefaultKind(kind)} />
          ))}
        </View>
        {!canEdit ? <Text style={[s.sub, { marginTop: 8 }]}>Only the owner or a manager can change this.</Text> : null}
      </Card>

      <Pressable onPress={() => router.push("/hours")} accessibilityRole="button">
        <Card>
          <Label>Store hours</Label>
          <Body>{branch?.now?.hasHours ? `Last orders ${branch.orderCutoffMinutes} min before closing.` : "Not set yet."}</Body>
          <Text style={[s.body, { color: C.teal, fontWeight: "600", marginTop: 4 }]}>{canEdit ? "View or change hours" : "View hours"}</Text>
        </Card>
      </Pressable>

      <Card tone={deposit.available != null && deposit.available < deposit.pickupMinimum ? "attention" : undefined}>
        <Label>Deposit</Label>
        <Body>{money(deposit.available)} available</Body>
        <Text style={s.sub}>
          Sentroh's commission on pickup orders comes from this deposit
          {merchant.commissionRate ? ` (${merchant.commissionRate}% of items)` : " (no commission for your store right now)"}.
          Pickup turns off below {money(deposit.pickupMinimum)}. To top up, contact Sentroh.
        </Text>
      </Card>

      {stores.length > 1 ? (
        <Card>
          <Label>Your stores</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {stores.map((st) => (
              <View key={st.merchantId} style={{ marginBottom: 8 }}>
                <Chip label={st.merchantName} active={st.merchantId === storeId} onPress={() => selectStore(st.merchantId)} />
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {branch?.address ? <Text style={[s.sub, { marginBottom: 16 }]}>{branch.name}: {branch.address}</Text> : null}
      <Button title="Sign out" kind="secondary" onPress={signOut} />
    </Screen>
  );
}
