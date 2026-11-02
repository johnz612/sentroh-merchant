import { useEffect, useRef, useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Button, Card, Field, Notice, s, Screen, Skeleton } from "@/components/ui";
import { forgetCached } from "@/lib/cache";
import { C } from "@/lib/theme";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "6:00" / "06:00" / "6" -> "06:00", or null. */
function normalizeTime(v) {
  const m = String(v || "").trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const t = `${m[1].padStart(2, "0")}:${m[2] || "00"}`;
  return TIME.test(t) ? t : null;
}

/** One opening period per day. (The API allows more, e.g. a lunch break; ask Sentroh for that.) */
export default function Hours() {
  const { storeId, call, canEdit, keyFor } = useStore();
  const { data, error, reload } = useLoader(() => call("/hours"), [storeId], { key: keyFor("/hours") });
  const filled = useRef(false);
  const [days, setDays] = useState(DAYS.map(() => ({ open: true, opens: "06:00", closes: "22:00" })));
  const [cutoff, setCutoff] = useState("10");
  const [extraPeriods, setExtraPeriods] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    // Fill the form once (from the saved copy or the first answer); later refreshes never overwrite typing.
    if (!data || filled.current) return;
    filled.current = true;
    setCutoff(String(data.orderCutoffMinutes ?? 10));
    if (data.hours.length === 0) return;
    setExtraPeriods(DAYS.some((_, i) => data.hours.filter((h) => h.weekday === i + 1).length > 1));
    setDays(DAYS.map((_, i) => {
      const first = data.hours.find((h) => h.weekday === i + 1);
      return first ? { open: true, opens: first.opens, closes: first.closes } : { open: false, opens: "06:00", closes: "22:00" };
    }));
  }, [data]);

  if (!data) return <Screen>{error ? <Notice error={error} /> : <Skeleton kind="cards" rows={4} pad={0} what="Loading hours" />}</Screen>;

  const update = (i, patch) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save() {
    setFailure(null); setDone(null);
    const hours = [];
    for (let i = 0; i < 7; i += 1) {
      if (!days[i].open) continue;
      const opens = normalizeTime(days[i].opens);
      const closes = normalizeTime(days[i].closes);
      if (!opens || !closes) return setFailure(new Error(`${DAYS[i]}: use times like 06:00 and 22:00 (24-hour).`));
      if (closes <= opens) return setFailure(new Error(`${DAYS[i]}: closing must be after opening, the same day.`));
      hours.push({ weekday: i + 1, opens, closes });
    }
    const minutes = Number(cutoff);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 180) return setFailure(new Error("Last-order time must be 0 to 180 minutes before closing."));

    setBusy(true);
    try {
      await call("/hours", { method: "PUT", body: { hours, orderCutoffMinutes: minutes } });
      setDone(hours.length === 0 ? "Saved. Your store is closed all week." : "Hours saved.");
      setExtraPeriods(false);
      forgetCached(`${storeId}|/store`); // store tab shows the new hours when you go back
      reload();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Body muted style={{ marginBottom: 12 }}>Philippine time, 24-hour clock (22:00 = 10 PM). Customers can browse while you are closed, but can't order.</Body>
      {extraPeriods ? <Notice kind="info">Some days have more than one opening period. Saving here keeps only the first period of each day.</Notice> : null}
      <Notice kind="ok">{done}</Notice>

      {DAYS.map((day, i) => (
        <Card key={day}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={[s.body, { fontWeight: "700" }]}>{day}</Text>
            <View style={s.row}>
              <Text style={[s.sub, { marginRight: 8 }]}>{days[i].open ? "Open" : "Closed"}</Text>
              <Switch value={days[i].open} disabled={!canEdit} onValueChange={(v) => update(i, { open: v })} trackColor={{ true: C.teal, false: "#C8D1CE" }} thumbColor="#fff" />
            </View>
          </View>
          {days[i].open ? (
            <View style={[s.row, { marginTop: 8 }]}>
              <TextInput style={[s.input, { flex: 1 }]} value={days[i].opens} editable={canEdit} onChangeText={(v) => update(i, { opens: v })} keyboardType="numbers-and-punctuation" accessibilityLabel={`${day} opens`} />
              <Text style={[s.body, { marginHorizontal: 10 }]}>to</Text>
              <TextInput style={[s.input, { flex: 1 }]} value={days[i].closes} editable={canEdit} onChangeText={(v) => update(i, { closes: v })} keyboardType="numbers-and-punctuation" accessibilityLabel={`${day} closes`} />
            </View>
          ) : null}
          {canEdit && i === 0 && days[0].open ? (
            <Text onPress={() => setDays((d) => d.map(() => ({ ...d[0] })))} style={[s.body, { color: C.teal, fontWeight: "600", marginTop: 8 }]}>
              Use Monday's hours for every day
            </Text>
          ) : null}
        </Card>
      ))}

      <Card>
        <Field label="Last orders, minutes before closing" hint="Gives you time to prepare the last orders. 10 is a good start." keyboardType="number-pad"
          value={cutoff} onChangeText={setCutoff} editable={canEdit} />
      </Card>

      <Notice error={failure} />
      {canEdit ? <Button title="Save hours" onPress={save} busy={busy} /> : <Notice kind="info">Only the owner or a manager can change store hours.</Notice>}
    </Screen>
  );
}
