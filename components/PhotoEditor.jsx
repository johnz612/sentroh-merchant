import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { turnedSize } from "@/lib/photos";
import { C } from "@/lib/theme";

const MAX_ZOOM = 6; // times the zoom that just fills the square

/**
 * Square photo editor: drag to move, pinch to zoom, "Rotate" turns the photo
 * a quarter turn. The square is what customers see.
 * Packaged items (fill = false): zooming out past "fills the square" shows the whole
 * photo on plain white (as the apps show it), and the photo stays centred that way.
 * Cooked food (fill = true): the photo always fills the square (as the apps show dishes).
 *
 * photo: { uri, width, height } (the uncropped photo when there is one)
 * crop:  last saved { rotate, x, y, size } in pixels of the turned photo, or null (start centred)
 * onDone({ rotate, x, y, size }) with the chosen square, in the same pixels.
 */
export function PhotoEditor({ photo, crop, busy, onCancel, onDone, title = "Adjust photo", fill = false }) {
  const { width: screenW } = useWindowDimensions();
  const frame = Math.min(screenW - 32, 480);
  const [rotate, setRotate] = useState(crop?.rotate ?? 0);

  // Plain numbers for the gesture code: it runs on another thread and cannot take
  // `photo` itself (a saved photo carries a loaded image that cannot be copied there).
  const photoW = photo.width;
  const photoH = photo.height;
  const turned = turnedSize(photoW, photoH, rotate);
  // fillScale: the photo just fills the square. minScale: the smallest zoom allowed
  // (the whole photo fits in the square; dishes always fill it).
  const fillScale = frame / Math.min(turned.width, turned.height);
  const minScale = fill ? fillScale : frame / Math.max(turned.width, turned.height);

  /**
   * Keeps the photo where it can be: covering the square when it is bigger than it,
   * centred when it is smaller (the apps show a smaller photo centred too).
   */
  function place(pos, length) {
    "worklet";
    return length >= frame ? Math.min(0, Math.max(frame - length, pos)) : (frame - length) / 2;
  }

  /** Where the photo starts: at the saved square, or centred and just filling the square. */
  function startView() {
    const saved = crop && crop.rotate === rotate ? crop : null;
    if (saved) {
      const sc = Math.min(Math.max(frame / saved.size, minScale), fillScale * MAX_ZOOM);
      return { scale: sc, x: place(-saved.x * sc, turned.width * sc), y: place(-saved.y * sc, turned.height * sc) };
    }
    return { scale: fillScale, x: (frame - turned.width * fillScale) / 2, y: (frame - turned.height * fillScale) / 2 };
  }
  const first = startView();

  // Position of the turned photo's top-left corner inside the square, and its zoom (screen px per photo px).
  const tx = useSharedValue(first.x);
  const ty = useSharedValue(first.y);
  const scale = useSharedValue(first.scale);
  const tw = useSharedValue(turned.width);
  const th = useSharedValue(turned.height);
  const minS = useSharedValue(minScale);
  const maxS = useSharedValue(fillScale * MAX_ZOOM);

  // After a quarter turn (or a new photo or screen size), start again from the start view.
  useEffect(() => {
    const v = startView();
    tw.value = turned.width;
    th.value = turned.height;
    minS.value = minScale;
    maxS.value = fillScale * MAX_ZOOM;
    scale.value = v.scale;
    tx.value = v.x;
    ty.value = v.y;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotate, frame, photo.uri, fill]);

  // Both gestures apply small steps (changeX, scaleChange), so moving and zooming together add up.
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onChange((e) => {
      const sc = scale.value;
      tx.value = place(tx.value + e.changeX, tw.value * sc);
      ty.value = place(ty.value + e.changeY, th.value * sc);
    });

  const pinch = Gesture.Pinch()
    .onChange((e) => {
      const s0 = scale.value;
      const sc = Math.min(Math.max(s0 * e.scaleChange, minS.value), maxS.value);
      const k = sc / s0;
      // Keep the point between the fingers in place.
      scale.value = sc;
      tx.value = place(e.focalX - (e.focalX - tx.value) * k, tw.value * sc);
      ty.value = place(e.focalY - (e.focalY - ty.value) * k, th.value * sc);
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  // The turned photo's box; the image inside is turned around the box's centre.
  const boxStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: tx.value,
    top: ty.value,
    width: tw.value * scale.value,
    height: th.value * scale.value,
  }));
  const imageStyle = useAnimatedStyle(() => {
    const w = photoW * scale.value;
    const h = photoH * scale.value;
    return {
      position: "absolute",
      width: w,
      height: h,
      left: (tw.value * scale.value - w) / 2,
      top: (th.value * scale.value - h) / 2,
      transform: [{ rotate: `${rotate}deg` }],
    };
  }, [rotate, photoW, photoH]);

  function finish() {
    const s = scale.value;
    onDone({ rotate, x: -tx.value / s, y: -ty.value / s, size: frame / s });
  }

  return (
    <Modal animationType="slide" visible onRequestClose={busy ? undefined : onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{title}</Text>
            <Text style={{ color: "#C9D2DE", marginTop: 4 }}>
              {fill
                ? "Drag to move, pinch to zoom. The square is what customers see: dishes fill the whole square."
                : "Drag to move, pinch to zoom. The square is what customers see. Zoom out to show the whole product; the space around it stays white."}
            </Text>
          </View>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <GestureDetector gesture={gesture}>
              {/* White around a photo that doesn't fill the square, as customers see it. */}
              <View style={{ width: frame, height: frame, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#fff" }}
                accessibilityLabel="Photo crop area" accessibilityHint="Drag to move the photo, pinch to zoom">
                <Animated.View style={boxStyle}>
                  <Animated.View style={imageStyle}>
                    <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} contentFit="fill" />
                  </Animated.View>
                </Animated.View>
              </View>
            </GestureDetector>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setRotate((r) => (r + 90) % 360)}
              style={({ pressed }) => ({ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
                borderWidth: 1, borderColor: "#fff", opacity: busy ? 0.5 : pressed ? 0.7 : 1 })}>
              <Text style={{ color: "#fff", fontWeight: "600" }}>⟳  Rotate</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", padding: 16 }}>
            <Button title="Cancel" kind="secondary" style={{ flex: 1, marginRight: 8 }} disabled={busy} onPress={onCancel} />
            <Button title="Use photo" style={{ flex: 1, backgroundColor: C.teal }} busy={busy} onPress={finish} />
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}
