import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Notice, s } from "@/components/ui";
import { DEFAULT_CENTER, placeToAddress, usePinPick } from "@/lib/pinPick";
import { C } from "@/lib/theme";

// The map is native code: an app built before it was added has no map yet.
// Load it carefully so the rest of the app keeps working until the app is rebuilt.
let Maps = null;
try { Maps = require("react-native-maps"); } catch { Maps = null; }
// Without a Google Maps key the map crashes the app: don't show it then. (In a
// development build this tells whether Metro sees the key; rebuild after adding it.)
const mapsKeyInBuild = Constants.expoConfig?.extra?.mapsKeyInBuild === true;
const MapView = (mapsKeyInBuild && Maps?.default) || null;
const PROVIDER_GOOGLE = Maps?.PROVIDER_GOOGLE;

const CLOSE = { latitudeDelta: 0.0025, longitudeDelta: 0.0025 }; // about one block
const round7 = (n) => Number(n.toFixed(7));

/**
 * Store location: drag the map so the pin sits on the store (like Grab). The pin stays in the
 * middle; the map moves under it. Satellite view helps find the roof.
 * The address text comes from the phone's own geocoder (free, no key).
 * Opened from the store registration; the spot goes back through usePinPick.
 */
export default function PinMap() {
  const router = useRouter();
  const start = usePinPick((st) => st.start);
  const confirm = usePinPick((st) => st.confirm);
  const map = useRef(null);
  const [center, setCenter] = useState(start || DEFAULT_CENTER);
  const [satellite, setSatellite] = useState(false);
  const [place, setPlace] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const lookup = useRef(0);

  // No saved pin: start at the phone's location when allowed.
  useEffect(() => {
    if (!start) goToMe(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the area under the pin (best effort; the store types its address anyway).
  useEffect(() => {
    const id = ++lookup.current;
    const t = setTimeout(async () => {
      try {
        const [p] = await Location.reverseGeocodeAsync(center);
        if (id === lookup.current) setPlace(p || null);
      } catch {
        if (id === lookup.current) setPlace(null);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [center]);

  async function goToMe(quiet) {
    setError(null); setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Allow location to start the map where you are.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCenter(here);
      map.current?.animateToRegion({ ...here, ...CLOSE }, 400);
    } catch (err) {
      if (!quiet) setError(err);
    } finally {
      setLocating(false);
    }
  }

  function done() {
    confirm({ latitude: round7(center.latitude), longitude: round7(center.longitude), place: placeToAddress(place) });
    router.back();
  }

  if (!MapView) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper, padding: 24, justifyContent: "center" }}>
        <Text style={[s.title, { marginBottom: 8 }]}>Map not in this build yet</Text>
        <Text style={[s.sub, { marginBottom: 16 }]}>This copy of the app was built without the map or without its Google Maps key. Set GOOGLE_MAPS_ANDROID_API_KEY (in .env.local) and rebuild the app to use the map. For now, use "I'm at the store".</Text>
        <Button title="Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const area = place ? [place.street || place.name, place.district, place.city].filter(Boolean).join(", ") : "";

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <MapView
        ref={map}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{ ...(start || DEFAULT_CENTER), ...CLOSE }}
        mapType={satellite ? "hybrid" : "standard"}
        onRegionChangeComplete={(r) => setCenter({ latitude: r.latitude, longitude: r.longitude })}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      />

      {/* The pin stays in the middle: its tip marks the spot. */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="location" size={44} color={C.teal} style={{ marginBottom: 44 }} />
      </View>

      <SafeAreaView edges={["top"]} pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <View style={[s.row, { justifyContent: "space-between", padding: 12 }]} pointerEvents="box-none">
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close map"
            style={{ backgroundColor: "#fff", borderRadius: 22, padding: 10, elevation: 3 }}>
            <Ionicons name="close" size={22} color={C.ink} />
          </Pressable>
          <Pressable onPress={() => setSatellite((v) => !v)} accessibilityRole="button"
            style={{ backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, elevation: 3 }}>
            <Text style={{ fontWeight: "700", color: C.ink }}>{satellite ? "Map" : "Satellite"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: C.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, elevation: 8 }}>
        <View style={[s.row, { justifyContent: "space-between", marginBottom: 8 }]}>
          <Text style={[s.body, { fontWeight: "800", flex: 1 }]}>Move the map so the pin is on your store</Text>
          <Pressable onPress={() => goToMe(false)} accessibilityRole="button" accessibilityLabel="Go to my location" style={{ padding: 6 }}>
            <Ionicons name={locating ? "hourglass-outline" : "locate"} size={24} color={C.teal} />
          </Pressable>
        </View>
        <Text style={s.sub} numberOfLines={2}>{area || "Zoom in and use Satellite to find your store's roof."}</Text>
        <Notice error={error} />
        <Button title="Use this spot" style={{ marginTop: 10 }} onPress={done} />
      </SafeAreaView>
    </View>
  );
}
