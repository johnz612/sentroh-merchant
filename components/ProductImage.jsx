import { Image } from "expo-image";
import { View } from "react-native";

/**
 * A product photo in its box, the way customers see it in the Sentroh app:
 * - fill (cooked food): the photo fills the whole box, edges may be cut (like Grab Food).
 * - otherwise (packaged items): the whole photo is shown on plain white (like Shopee).
 */
export function ProductImage({ uri, style, placeholder, recyclingKey, transition, fill = false }) {
  return (
    <View style={[{ overflow: "hidden", backgroundColor: "#FFFFFF" }, style]}>
      <Image source={{ uri }} placeholder={placeholder} style={{ width: "100%", height: "100%" }} contentFit={fill ? "cover" : "contain"}
        cachePolicy="memory-disk" recyclingKey={recyclingKey} transition={transition} />
    </View>
  );
}
