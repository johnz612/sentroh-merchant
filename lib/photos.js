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

/** Product page photo (longest side, px), list thumbnail (px), and the uncropped original kept for "Adjust" (longest side, px). */
const PHOTO_PX = 1280;
const THUMB_PX = 320;
const ORIGINAL_PX = 1600;

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

/** True when this installed app has the photo-shrinking module (and so the photo editor). */
export function canShrink() {
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

// ---- Photo editor (move, zoom, rotate) -----------------------------------------------------------

/** True when this app can move, zoom and rotate photos (the newer image manipulator API). */
export function canAdjust() {
  try {
    return !!IM && typeof IM.ImageManipulator?.manipulate === "function";
  } catch {
    return false;
  }
}

/** Runs rotate/crop/resize steps and saves a JPEG. `source` is a file URI or an image loaded with expo-image. */
async function render(source, steps, compress) {
  if (IM.ImageManipulator?.manipulate) {
    const context = IM.ImageManipulator.manipulate(source);
    for (const step of steps) {
      if (step.rotate) context.rotate(step.rotate);
      if (step.crop) context.crop(step.crop);
      if (step.resize) context.resize(step.resize);
    }
    const rendered = await context.renderAsync();
    return rendered.saveAsync({ compress, format: IM.SaveFormat.JPEG });
  }
  return IM.manipulateAsync(source, steps, { compress, format: IM.SaveFormat.JPEG });
}

/**
 * The uncropped photo kept for adjusting later: the picked photo shrunk to
 * at most 1600 px on its longest side (JPEG). The editor crops from this
 * copy, so saved crop numbers are in its pixels.
 */
export async function makeOriginal(asset) {
  const w = asset.width || ORIGINAL_PX;
  const h = asset.height || ORIGINAL_PX;
  const resize = w >= h ? { width: Math.min(ORIGINAL_PX, w) } : { height: Math.min(ORIGINAL_PX, h) };
  return render(asset.uri, [{ resize }], 0.8);
}

/** Width and height after turning the photo by `rotate` degrees. */
export function turnedSize(width, height, rotate) {
  return rotate % 180 === 0 ? { width, height } : { width: height, height: width };
}

/** Keeps a crop square inside the turned photo (rounding can push it 1 px out). */
export function fitCrop(crop, width, height) {
  const turned = turnedSize(width, height, crop.rotate);
  const size = Math.max(1, Math.min(Math.round(crop.size), turned.width, turned.height));
  const x = Math.min(Math.max(0, Math.round(crop.x)), turned.width - size);
  const y = Math.min(Math.max(0, Math.round(crop.y)), turned.height - size);
  return { rotate: crop.rotate, x, y, size };
}

/**
 * Cuts the square the store chose out of `source` ({ ref or uri, width, height }):
 * the product photo (at most 1280 px) and its 320 px copy for lists.
 */
export async function cropPhoto(source, crop) {
  const c = fitCrop(crop, source.width, source.height);
  const steps = [];
  if (c.rotate) steps.push({ rotate: c.rotate });
  steps.push({ crop: { originX: c.x, originY: c.y, width: c.size, height: c.size } });
  if (c.size > PHOTO_PX) steps.push({ resize: { width: PHOTO_PX } });
  const photo = await render(source.ref ?? source.uri, steps, 0.8);
  const thumb = await resizeToJpeg(photo.uri, Math.min(THUMB_PX, photo.width || THUMB_PX), 0.7);
  return { photo, thumb, crop: c };
}

/**
 * Loads a stored photo for the editor: { uri (for showing), ref (for cutting), width, height }.
 * The image manipulator cannot read web addresses, so the photo is loaded with expo-image.
 */
export async function loadStoredPhoto(url) {
  // eslint-disable-next-line global-require
  const { Image } = require("expo-image");
  const ref = await Image.loadAsync({ uri: url });
  return { uri: url, ref, width: ref.width, height: ref.height };
}
