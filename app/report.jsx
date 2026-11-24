import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/AppText";

import { useLoader, useStore } from "@/components/hooks";
import { Button, Card, Chip, Field, Label, Notice, s, Screen, Skeleton } from "@/components/ui";
import { C } from "@/lib/theme";
import { toast } from "@/lib/toast";

const CHOICES = [
  ["UNPAID", "Unpaid orders"],
  ["THIS_WEEK", "This week"],
  ["LAST_WEEK", "Last week"],
  ["THIS_MONTH", "This month"],
  ["LAST_MONTH", "Last month"],
  ["LAST_3_MONTHS", "Last 3 months"],
];

/** Email the store a spreadsheet: every order, paid or not, with payout dates and references. */
export default function ReportScreen() {
  const { storeId, store, call, keyFor } = useStore();
  const isOwner = store?.role === "OWNER";
  const { data, error, reload } = useLoader(() => call("/report-email"), [storeId], { key: keyFor("/report-email") });
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState("THIS_MONTH");
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    if (data) {
      setEmail(data.email || "");
      setEditing(!data.email);
    }
  }, [data]);

  if (!data) return <Screen>{error ? <Notice error={error} /> : <Skeleton kind="cards" rows={2} pad={0} what="Loading" />}</Screen>;

  async function save() {
    setBusy("save"); setFailure(null);
    try {
      const res = await call("/report-email", { method: "PUT", body: { email } });
      setEmail(res.email || "");
      setEditing(!res.email);
      reload();
      toast("Email saved");
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setBusy("send"); setFailure(null);
    try {
      const body = choice === "UNPAID" ? { kind: "UNPAID" } : { kind: "ORDERS", range: choice };
      const res = await call("/earnings/email", { method: "POST", body });
      toast(`Sent to ${res.sentTo}`);
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(null);
    }
  }

  const saved = data.email;

  return (
    <Screen>
      <Text style={[s.body, { marginBottom: 12 }]}>
        Get a spreadsheet you can open in Excel or Google Sheets. Every order is one row: Paid (with the date and reference),
        Not paid yet (with the day it is due) or Cash at store.
      </Text>

      {!data.emailReady ? (
        <Notice kind="info">Sentroh is still setting up email. You can save your email now; sending will work soon.</Notice>
      ) : null}

      <Card>
        <Label>Send to</Label>
        {editing && isOwner ? (
          <>
            <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@gmail.com"
              keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <View style={[s.row, { gap: 8 }]}>
              <Button title="Save email" onPress={save} busy={busy === "save"} disabled={!email.trim()} style={{ flex: 1 }} />
              {saved ? <Button title="Cancel" kind="secondary" onPress={() => { setEmail(saved); setEditing(false); }} style={{ flex: 1 }} /> : null}
            </View>
          </>
        ) : saved ? (
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={[s.body, { fontWeight: "700", flexShrink: 1 }]}>{saved}</Text>
            {isOwner ? (
              <Text onPress={() => setEditing(true)} style={[s.body, { fontWeight: "700", textDecorationLine: "underline", marginLeft: 12 }]}>Change</Text>
            ) : null}
          </View>
        ) : (
          <Text style={s.sub}>The store owner needs to add an email address first.</Text>
        )}
      </Card>

      <Card>
        <Label>Which orders</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {CHOICES.map(([key, label]) => (
            <View key={key} style={{ marginBottom: 8 }}>
              <Chip label={label} active={choice === key} onPress={() => setChoice(key)} />
            </View>
          ))}
        </View>
        <Text style={s.sub}>
          {choice === "UNPAID"
            ? "Every delivery order Sentroh has not paid yet, from any date."
            : "All completed orders in these dates, plus the payouts Sentroh made in them."}
        </Text>
      </Card>

      {failure ? <Notice error={failure} /> : null}
      <Button title="Email the report" onPress={send} busy={busy === "send"} disabled={!saved || editing || !data.emailReady} />
      <Text style={[s.sub, { marginTop: 8, color: C.inkSoft }]}>Up to 10 reports a day.</Text>
    </Screen>
  );
}
