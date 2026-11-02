import * as IM from "expo-image-manipulator";

/** Product page photo (longest side, px) and list thumbnail (px). */
const PHOTO_PX = 1280;
const THUMB_PX = 320;

async function resizeToJpeg(uri, width, compress) {
  // Current API (SDK 52+): ImageManipulator.manipulate(uri) → resize → render → save.
  if (IM.ImageManipulator?.manipulate) {
    const context = IM.ImageManipulator.manipulate(uri);
    context.resize({ width, height: null });
    const rendered = await context.renderAsync();
    return rendered.saveAsync({ compress, format: IM.SaveFormat.JPEG });
  }
  // Older API, still shipped as deprecated.
  return IM.manipulateAsync(uri, [{ resize: { width } }], { compress, format: IM.SaveFormat.JPEG });
}

/**
 * Shrinks a picked photo on the phone before upload: a JPEG of at most
 * 1280 px for the product page and a 320 px JPEG for lists. Camera photos
 * are often 3–5 MB; these are typically a few hundred KB and ~20 KB.
 * Returns { photo: { uri, width, height }, thumb: { uri, width, height } }.
 */
export async function prepareProductPhoto(asset) {
  const width = Math.min(PHOTO_PX, asset.width || PHOTO_PX);
  const photo = await resizeToJpeg(asset.uri, width, 0.8);
  const thumb = await resizeToJpeg(photo.uri, Math.min(THUMB_PX, photo.width || THUMB_PX), 0.7);
  return { photo, thumb };
}

/** Reads a local file as bytes for upload. */
export async function fileBytes(uri) {
  return (await fetch(uri)).arrayBuffer();
}
