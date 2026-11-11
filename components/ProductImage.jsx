import { Image } from "expo-image";
import { View } from "react-native";

/**
 * A product photo in its box, as customers see it in the Sentroh app: the whole photo
 * is always shown, never cut; the space around a photo that is not square is plain white.
 * (fill = cover the box and cut the edges; not used for product photos.)
 */
export function ProductImage({ uri, style, placeholder, recyclingKey, transition, fill = false }) {
  return (
    <View style={[{ overflow: "hidden", backgroundColor: "#FFFFFF" }, style]}>
      <Image source={{ uri }} placeholder={placeholder} style={{ width: "100%", height: "100%" }} contentFit={fill ? "cover" : "contain"}
        cachePolicy="memory-disk" recyclingKey={recyclingKey} transition={transition} />
    </View>
  );
}
