import * as Notifications from "expo-notifications";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Toast } from "@/components/Toast";
import { Button, Loading, Notice, Screen, Title } from "@/components/ui";
import { clearCache } from "@/lib/cache";
import { registerForPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { warmUpStore } from "@/lib/warmUp";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";

/** Sends people to the right place: sign-in, store registration, or the store tabs. */
function useGate() {
  const status = useSession((st) => st.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const top = segments[0];
    if (status === "signed-out" && top !== "sign-in") router.replace("/sign-in");
    else if (status === "no-store" && top !== "register" && top !== "pin-map") router.replace("/register");
    else if (status === "ready" && (top === "sign-in" || top === "register")) router.replace("/");
  }, [status, segments, router]);
}

/** Loads every tab's data in the background once a store is open. */
function useWarmUp() {
  const status = useSession((st) => st.status);
  const storeId = useSession((st) => st.storeId);
  const role = useSession((st) => st.stores.find((x) => x.merchantId === st.storeId)?.role);

  useEffect(() => {
    if (status === "ready" && storeId) warmUpStore(storeId, { canEdit: role === "OWNER" || role === "MANAGER" });
  }, [status, storeId, role]);
}

/** New-order alerts: register the phone once a store is ready; tapping an alert opens the order. */
function usePush() {
  const status = useSession((st) => st.status);
  const router = useRouter();

  useEffect(() => {
    if (status === "ready") registerForPush();
  }, [status]);

  useEffect(() => {
    const open = (response) => {
      const orderId = response?.notification?.request?.content?.data?.orderId;
      if (orderId) router.push(`/order/${orderId}`);
    };
    Notifications.getLastNotificationResponseAsync().then((r) => r && open(r)).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}

function Root() {
  const status = useSession((st) => st.status);
  const error = useSession((st) => st.error);
  const load = useSession((st) => st.load);

  useEffect(() => {
    load();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearCache();
        useSession.setState({ status: "signed-out", stores: [], storeId: null });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  useGate();
  usePush();
  useWarmUp();

  if (status === "loading") return <Screen><Loading what="Opening your store" /></Screen>;
  if (status === "error") {
    return (
      <Screen>
        <Title>Cannot reach Sentroh</Title>
        <Notice>{error}</Notice>
        <Button title="Try again" onPress={load} />
      </Screen>
    );
  }

  return (
    <Stack screenOptions={{ headerTintColor: C.ink, headerStyle: { backgroundColor: C.surface }, contentStyle: { backgroundColor: C.paper } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: "Register your store" }} />
      <Stack.Screen name="pin-map" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="order/[orderId]" options={{ title: "Order" }} />
      <Stack.Screen name="product/[productId]" options={{ title: "Product" }} />
      <Stack.Screen name="hours" options={{ title: "Store hours" }} />
      <Stack.Screen name="choice-group" options={{ title: "Choices" }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Root />
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
