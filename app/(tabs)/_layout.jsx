import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { View } from "react-native";

import { FONT } from "@/components/AppText";
import { useStore } from "@/components/hooks";
import { C } from "@/lib/theme";

// Active tab: filled black icon with a short mango bar above it (same as the customer app).
const icon = (name) => ({ color, focused }) => (
  <View style={{ alignItems: "center" }}>
    <View style={{ width: 28, height: 4, borderRadius: 2, marginBottom: 4, backgroundColor: focused ? C.mango : "transparent" }} />
    <Ionicons name={focused ? name.replace("-outline", "") : name} color={color} size={24} />
  </View>
);

export default function TabsLayout() {
  const { canEdit } = useStore();
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: C.ink,
      tabBarInactiveTintColor: C.inkSoft,
      tabBarLabelStyle: { fontFamily: FONT[600], fontSize: 12 },
      tabBarStyle: { height: 72, paddingBottom: 8, borderTopColor: C.line },
      headerTintColor: C.ink,
      headerTitleStyle: { fontFamily: FONT[800], fontSize: 20 },
      headerShadowVisible: false,
      sceneStyle: { backgroundColor: C.paper },
    }}>
      <Tabs.Screen name="index" options={{ title: "Orders", tabBarIcon: icon("receipt-outline") }} />
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: icon("pricetags-outline") }} />
      <Tabs.Screen name="earnings" options={{ title: "Earnings", href: canEdit ? undefined : null, tabBarIcon: icon("wallet-outline") }} />
      <Tabs.Screen name="store" options={{ title: "Store", tabBarIcon: icon("storefront-outline") }} />
    </Tabs>
  );
}
