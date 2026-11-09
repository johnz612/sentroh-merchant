import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "@/lib/theme";
import { useToast } from "@/lib/toast";

/** The message from toast(...), floating above the bottom of every screen. Tap to hide. */
export function Toast() {
  const current = useToast((st) => st.toast);
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!current) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [current, fade]);

  if (!current) return null;
  const error = current.kind === "error";

  return (
    <Animated.View pointerEvents="box-none"
      style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 24, alignItems: "center", opacity: fade,
        transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <Pressable onPress={() => useToast.setState({ toast: null })} accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={{ flexDirection: "row", alignItems: "center", backgroundColor: error ? C.red : C.ink, borderRadius: 24,
          paddingVertical: 12, paddingHorizontal: 18, maxWidth: 480, elevation: 6,
          shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
        <Ionicons name={error ? "alert-circle" : "checkmark-circle"} size={20} color={error ? "#fff" : "#7FD1A8"} style={{ marginRight: 8 }} />
        <Text style={{ color: "#fff", fontWeight: "600", flexShrink: 1 }}>{current.text}</Text>
      </Pressable>
    </Animated.View>
  );
}
