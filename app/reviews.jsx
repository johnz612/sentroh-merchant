import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Text, TextInput } from "@/components/AppText";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Button, Card, Chip, Empty, Label, Notice, s, Screen, Skeleton } from "@/components/ui";
import { C } from "@/lib/theme";
import { toast } from "@/lib/toast";

const VIEWS = [["ALL", "All"], ["NO_REPLY", "Not replied"], ["LOW", "1–3 stars"]];
const REASONS = [["ABUSIVE", "Abusive or rude"], ["FAKE", "Fake or not a real order"], ["NOT_ABOUT_ORDER", "Not about the order"], ["OTHER", "Other"]];
const date = (iso) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

function Stars({ value, size = 16 }) {
  return <Text style={{ fontSize: size, color: C.mango, letterSpacing: 1 }}>{"★".repeat(value)}<Text style={{ color: C.line }}>{"★".repeat(5 - value)}</Text></Text>;
}

/**
 * Reviews of the store. Everyone can read them on Sentroh; the store can reply (public) and
 * report one to Sentroh (abusive, fake, not about the order). Stores cannot delete reviews.
 */
export default function ReviewsScreen() {
  const { storeId, call, canEdit, keyFor } = useStore();
  const [view, setView] = useState("ALL");
  const { data, error, reload } = useLoader(() => call("/reviews", { query: { view } }), [storeId, view], { key: keyFor(`/reviews?view=${view}`) });

  if (!data) return <Screen>{error ? <Notice error={error} /> : <Skeleton kind="cards" rows={4} pad={0} what="Loading reviews" />}</Screen>;

  const total = data.breakdown.reduce((n, b) => n + b.count, 0);
  return (
    <Screen>
      <Card>
        <View style={[s.row, { alignItems: "center", gap: 16 }]}>
          <View style={{ alignItems: "center", minWidth: 80 }}>
            <Text style={{ fontSize: 34, fontWeight: "800", color: C.ink }}>{total ? (data.rating.average ?? "—") : "—"}</Text>
            <Text style={s.sub}>{total} rating{total === 1 ? "" : "s"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {data.breakdown.map((b) => (
              <View key={b.stars} style={[s.row, { alignItems: "center", gap: 6 }]}>
                <Text style={[s.sub, { width: 14 }]}>{b.stars}</Text>
                <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: C.soft }}>
                  <View style={{ width: `${total ? (b.count / total) * 100 : 0}%`, height: 8, borderRadius: 4, backgroundColor: C.mango }} />
                </View>
                <Text style={[s.sub, { width: 26, textAlign: "right" }]}>{b.count}</Text>
              </View>
            ))}
          </View>
        </View>
        {!data.rating.shown ? (
          <Text style={[s.sub, { marginTop: 8 }]}>Customers see your stars once you have 5 ratings.</Text>
        ) : null}
      </Card>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        {VIEWS.map(([v, label]) => <Chip key={v} label={label} active={view === v} onPress={() => setView(v)} />)}
      </View>

      {data.reviews.length === 0 ? <Empty title="No reviews here">Reviews appear after customers rate their orders.</Empty> : null}
      {data.reviews.map((r) => <ReviewCard key={r.id} r={r} canEdit={canEdit} call={call} onDone={reload} />)}
    </Screen>
  );
}

function ReviewCard({ r, canEdit, call, onDone }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.reply?.text || "");
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);

  async function saveReply(text) {
    setBusy("reply"); setFailure(null);
    try {
      await call(`/reviews/${r.id}/reply`, { method: "POST", body: { reply: text } });
      setReplying(false);
      toast(text ? "Reply posted" : "Reply removed");
      onDone();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(null);
    }
  }

  function report(reason, text) {
    Alert.alert("Report this review?", `Reason: ${text}. Sentroh checks it and decides whether to hide it.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Report", style: "destructive", onPress: async () => {
        setBusy("report"); setFailure(null);
        try {
          await call(`/reviews/${r.id}/report`, { method: "POST", body: { reason } });
          setReporting(false);
          toast("Reported to Sentroh");
          onDone();
        } catch (err) {
          setFailure(err);
        } finally {
          setBusy(null);
        }
      } },
    ]);
  }

  return (
    <Card tone={r.stars <= 2 && !r.reply && !r.hidden ? "attention" : undefined}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Stars value={r.stars} />
        <Text style={[s.sub, { fontSize: 12 }]}>{r.by} · #{r.orderNumber} · {date(r.createdAt)}</Text>
      </View>
      {r.tags.length ? <Text style={[s.sub, { marginTop: 4 }]}>{r.tags.join(" · ")}</Text> : null}
      {r.comment ? <Body style={{ marginTop: 6 }}>{r.comment}</Body> : null}

      {r.hidden ? <Text style={[s.sub, { marginTop: 8, color: C.inkSoft }]}>Hidden by Sentroh: customers don't see it and it doesn't count.</Text> : null}
      {r.report ? (
        <Text style={[s.sub, { marginTop: 8 }]}>
          You reported it ({r.report.reasonText}).{" "}
          {r.report.outcome === "WAITING" ? "Sentroh is checking it." : r.report.outcome === "HIDDEN" ? "Sentroh hid it." : "Sentroh kept it."}
        </Text>
      ) : null}

      {r.reply && !replying ? (
        <View style={{ marginTop: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: C.mango, backgroundColor: C.mangoWash, borderRadius: 8 }}>
          <Text style={{ fontWeight: "800", fontSize: 13 }}>Your reply</Text>
          <Text style={s.body}>{r.reply.text}</Text>
        </View>
      ) : null}

      <Notice error={failure} />

      {replying ? (
        <View style={{ marginTop: 10 }}>
          <TextInput value={reply} onChangeText={setReply} multiline maxLength={500} placeholder="Thank them, or say how you will fix it. Everyone can read your reply."
            placeholderTextColor={C.inkSoft} style={[s.input, { minHeight: 80, textAlignVertical: "top" }]} />
          <View style={[s.row, { gap: 8, marginTop: 8 }]}>
            <Button title="Post reply" busy={busy === "reply"} disabled={!!busy || !reply.trim()} onPress={() => saveReply(reply.trim())} style={{ flex: 1 }} />
            <Button title="Cancel" kind="secondary" disabled={!!busy} onPress={() => { setReplying(false); setReply(r.reply?.text || ""); }} style={{ flex: 1 }} />
          </View>
          {r.reply ? <Pressable onPress={() => saveReply("")} style={{ marginTop: 8 }}><Text style={[s.sub, { textDecorationLine: "underline" }]}>Remove my reply</Text></Pressable> : null}
        </View>
      ) : null}

      {reporting ? (
        <View style={{ marginTop: 10 }}>
          <Label>Why report it?</Label>
          {REASONS.map(([key, text]) => (
            <Pressable key={key} onPress={() => report(key, text)} disabled={!!busy} accessibilityRole="button"
              style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text style={s.body}>{text}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setReporting(false)} style={{ paddingVertical: 10 }}><Text style={[s.sub, { textDecorationLine: "underline" }]}>Cancel</Text></Pressable>
        </View>
      ) : null}

      {canEdit && !r.hidden && !replying && !reporting ? (
        <View style={[s.row, { gap: 16, marginTop: 10 }]}>
          <Pressable onPress={() => setReplying(true)} accessibilityRole="button">
            <Text style={[s.body, { fontWeight: "700", textDecorationLine: "underline" }]}>{r.reply ? "Edit reply" : "Reply"}</Text>
          </Pressable>
          {!r.report ? (
            <Pressable onPress={() => setReporting(true)} accessibilityRole="button">
              <Text style={[s.body, { color: C.inkSoft, textDecorationLine: "underline" }]}>Report to Sentroh</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!canEdit ? <Text style={[s.sub, { marginTop: 8 }]}>Only the owner or a manager can reply.</Text> : null}
    </Card>
  );
}
