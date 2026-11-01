import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { C } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: C.teal,
      tabBarInactiveTintColor: C.inkSoft,
      headerTintColor: C.ink,
      headerTitleStyle: { fontWeight: "800" },
      sceneStyle: { backgroundColor: C.paper },
    }}>
      <Tabs.Screen name="index" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="store" options={{ title: "Store", tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
