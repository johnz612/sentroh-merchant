import { Image } from "expo-image";
import { View } from "react-native";

/**
 * A product photo in a square (or any box): the photo is shown whole, and when it is
 * not square (the store zoomed out to show the whole photo) the empty space is filled
 * with a soft, darker blurred copy of the same photo. Square photos look as before.
 */
export function ProductImage({ uri, style, placeholder, recyclingKey, transition }) {
  return (
    <View style={[{ overflow: "hidden", backgroundColor: "#1B2333" }, style]}>
      <Image source={{ uri }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover"
        blurRadius={18} cachePolicy="memory-disk" recyclingKey={recyclingKey} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.18)" }} />
      <Image source={{ uri }} placeholder={placeholder} style={{ width: "100%", height: "100%" }} contentFit="contain"
        cachePolicy="memory-disk" recyclingKey={recyclingKey} transition={transition} />
    </View>
  );
}
