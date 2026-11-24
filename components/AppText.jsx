import { forwardRef } from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from "react-native";

/**
 * Text and TextInput in Archivo (the Sentroh design system font). Each weight is its own
 * font file, so the weight in a style picks the file (Android does not make custom fonts bold
 * by itself). A style that names its own fontFamily keeps it.
 */
export const FONT = {
  400: "Archivo_400Regular",
  500: "Archivo_500Medium",
  600: "Archivo_600SemiBold",
  700: "Archivo_700Bold",
  800: "Archivo_800ExtraBold",
  900: "Archivo_800ExtraBold",
};

function withFont(style) {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) return style;
  const w = String(flat.fontWeight ?? "400");
  const key = w === "bold" ? "700" : w === "normal" ? "400" : w;
  return [style, { fontFamily: FONT[key] || FONT[400], fontWeight: "normal" }];
}

export const Text = forwardRef(function Text(props, ref) {
  return <RNText ref={ref} {...props} style={withFont(props.style)} />;
});

export const TextInput = forwardRef(function TextInput(props, ref) {
  return <RNTextInput ref={ref} {...props} style={withFont(props.style)} />;
});
