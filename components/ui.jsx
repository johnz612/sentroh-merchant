import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { C } from "@/lib/theme";

export function Screen({ children, scroll = true, edges = ["bottom"], contentStyle }) {
  return (
    <SafeAreaView style={s.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={[s.content, contentStyle]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[s.content, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, sub }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.title}>{children}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, tone, style }) {
  return <View style={[s.card, tone === "attention" && s.cardAttention, tone === "danger" && s.cardDanger, style]}>{children}</View>;
}

export function Label({ children }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Body({ children, muted, style }) {
  return <Text style={[s.body, muted && { color: C.inkSoft }, style]}>{children}</Text>;
}

export function Button({ title, onPress, kind = "primary", disabled, busy, style }) {
  const look = { primary: s.btnPrimary, secondary: s.btnSecondary, danger: s.btnDanger, attention: s.btnAttention }[kind];
  const textLook = { primary: s.btnTextLight, secondary: s.btnTextDark, danger: s.btnTextRed, attention: s.btnTextDark }[kind];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || busy}
      style={({ pressed }) => [s.btn, look, (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.85 }, style]}>
      {busy ? <ActivityIndicator color={kind === "primary" ? "#fff" : C.ink} /> : <Text style={[s.btnText, textLook]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, count }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}
      style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && { color: "#fff" }]}>{label}{count ? `  ${count}` : ""}</Text>
    </Pressable>
  );
}

/** Small "Required" or "Optional" tag after a field's label. */
export function FieldTag({ required }) {
  return required
    ? <Text style={{ color: C.red, fontWeight: "700" }}>  Required</Text>
    : <Text style={{ color: C.inkSoft, fontWeight: "400" }}>  Optional</Text>;
}

/** Text field. `required` or `optional` adds a tag after the label; `hint` explains the field below it. */
export function Field({ label, hint, required, optional, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}{required || optional ? <FieldTag required={!!required} /> : null}</Text>
      {hint ? <Text style={[s.sub, { marginBottom: 4 }]}>{hint}</Text> : null}
      <TextInput placeholderTextColor="#8A97A8" style={[s.input, props.editable === false && { backgroundColor: C.paper, color: C.inkSoft }]} {...props} />
    </View>
  );
}

export function Notice({ error, children, kind = "error" }) {
  const text = error ? error.message || String(error) : children;
  if (!text) return null;
  const look = { error: [s.notice, s.noticeError], ok: [s.notice, s.noticeOk], info: [s.notice, s.noticeInfo] }[error ? "error" : kind];
  return <Text style={look} accessibilityLiveRegion="polite">{text}</Text>;
}

/** Grey placeholder shapes shown while a screen loads for the first time (instead of a spinner). */
export function Skeleton({ rows = 6, kind = "list", what = "Loading", pad = 16 }) {
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const bar = (width, height = 12, extra) => <View style={[{ width, height, borderRadius: 6, backgroundColor: SKELETON }, extra]} />;
  return (
    <Animated.View style={{ opacity: pulse, padding: pad }} accessible accessibilityLabel={`${what}…`}>
      {Array.from({ length: rows }, (_, i) => (
        kind === "list" ? (
          <View key={i} style={[s.card, s.row, { paddingVertical: 10 }]}>
            <View style={{ width: 52, height: 52, borderRadius: 8, marginRight: 12, backgroundColor: SKELETON }} />
            <View style={{ flex: 1 }}>
              {bar("70%", 14)}
              {bar("45%", 12, { marginTop: 8 })}
            </View>
          </View>
        ) : (
          <View key={i} style={s.card}>
            {bar("35%", 12)}
            {bar("85%", 14, { marginTop: 10 })}
            {bar("60%", 14, { marginTop: 8 })}
          </View>
        )
      ))}
    </Animated.View>
  );
}

const SKELETON = "#E3E9E7";

export function Loading({ what = "Loading" }) {
  return (
    <View style={{ padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={C.teal} />
      <Text style={[s.sub, { marginTop: 8 }]}>{what}…</Text>
    </View>
  );
}

export function Empty({ title, children }) {
  return (
    <View style={{ padding: 32, alignItems: "center" }}>
      <Text style={[s.body, { fontWeight: "600", textAlign: "center" }]}>{title}</Text>
      {children ? <Text style={[s.sub, { textAlign: "center", marginTop: 4 }]}>{children}</Text> : null}
    </View>
  );
}

export function Pill({ text, tone = "muted" }) {
  const look = { attention: [C.mangoWash, C.mangoInk], active: [C.tealWash, C.teal], done: [C.greenWash, C.green], stopped: [C.redWash, C.red], muted: ["#ECEFF0", C.inkSoft] }[tone];
  return <Text style={[s.pill, { backgroundColor: look[0], color: look[1] }]}>{text}</Text>;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "800", color: C.ink, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: C.inkSoft, lineHeight: 18 },
  body: { fontSize: 15, color: C.ink, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: "700", color: C.ink, marginBottom: 4 },
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 14, marginBottom: 12 },
  cardAttention: { backgroundColor: C.mangoWash, borderColor: "#F3D36B" },
  cardDanger: { backgroundColor: C.redWash, borderColor: "#F0B4AE" },
  btn: { minHeight: 48, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  btnPrimary: { backgroundColor: C.teal, borderColor: C.teal },
  btnSecondary: { backgroundColor: C.surface, borderColor: "#B9C6C1" },
  btnDanger: { backgroundColor: C.surface, borderColor: "#F0B4AE" },
  btnAttention: { backgroundColor: C.mango, borderColor: C.mango },
  btnText: { fontSize: 16, fontWeight: "700" },
  btnTextLight: { color: "#fff" },
  btnTextDark: { color: C.ink },
  btnTextRed: { color: C.red },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, marginRight: 8 },
  chipActive: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 13, color: C.inkSoft, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#B9C6C1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.ink, backgroundColor: "#fff" },
  notice: { borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14, overflow: "hidden" },
  noticeError: { backgroundColor: C.redWash, color: C.red },
  noticeOk: { backgroundColor: C.greenWash, color: C.green },
  noticeInfo: { backgroundColor: C.tealWash, color: C.teal },
  pill: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, fontSize: 12, fontWeight: "700", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center" },
});
