/**
 * expo-image-manipulator is a native module: an app installed before it was
 * added does not have it until it is rebuilt. Then photos upload as picked
 * (no shrinking) instead of the app crashing.
 */
let IM = null;
try {
  IM = require("expo-image-manipulator"); // eslint-disable-line global-require
} catch {
  IM = null;
}

const PICKED_TYPES = { "image/jpeg": true, "image/png": true, "image/webp": true };

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
  if (!canShrink()) return asPicked(asset);
  const width = Math.min(PHOTO_PX, asset.width || PHOTO_PX);
  const photo = await resizeToJpeg(asset.uri, width, 0.8);
  const thumb = await resizeToJpeg(photo.uri, Math.min(THUMB_PX, photo.width || THUMB_PX), 0.7);
  return { photo, thumb, contentType: "image/jpeg" };
}

/** True when this installed app has the photo-shrinking module. */
function canShrink() {
  try {
    return !!IM && (typeof IM.ImageManipulator?.manipulate === "function" || typeof IM.manipulateAsync === "function");
  } catch {
    return false;
  }
}

/** Without the module: the picked photo as is (no list thumbnail). */
function asPicked(asset) {
  const type = asset.mimeType || "image/jpeg";
  if (!PICKED_TYPES[type]) throw new Error("This photo type cannot be uploaded. Update the Sentroh Merchant app, or pick a JPEG or PNG photo.");
  return { photo: { uri: asset.uri, width: asset.width, height: asset.height }, thumb: null, contentType: type };
}

/** Reads a local file as bytes for upload. */
export async function fileBytes(uri) {
  return (await fetch(uri)).arrayBuffer();
}
