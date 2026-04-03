import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Compress aggressively for the identify call.
 * ~800px longest side, 60% JPEG quality — typically reduces a phone photo
 * from 3-5 MB to roughly 50-150 KB (varies by image content). The identify
 * endpoint uses low-detail vision mode (~512x512), so sending anything larger
 * is wasted bandwidth.
 *
 * Returns compressed base64, or null if compression fails (errors are caught
 * and logged internally; caller should fall back to the original base64).
 */
export async function compressForIdentify(uri: string): Promise<string | null> {
  try {
    const { width, height } = await getImageSize(uri);
    const longestSide = Math.max(width, height);
    const actions =
      longestSide > 800
        ? [width >= height ? { resize: { width: 800 } } : { resize: { height: 800 } }]
        : [];

    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    const compressed = result.base64 || null;
    if (compressed) {
      console.log(
        `[compressForIdentify] ${(compressed.length * 0.75 / 1024).toFixed(0)} KB` +
        ` (original longest side: ${longestSide}px)`
      );
    }
    return compressed;
  } catch (err) {
    console.error("[compressForIdentify] Compression failed, falling back to original:", err);
    return null;
  }
}

/**
 * Compress minimally for Supabase Storage (training set).
 * ~2048px longest side, 85% JPEG quality — preserves most detail while
 * significantly reducing file size vs full device resolution.
 *
 * Returns compressed base64, or null if compression fails (errors are caught
 * and logged internally; caller should fall back to the original base64).
 */
export async function compressForStorage(uri: string): Promise<string | null> {
  try {
    const { width, height } = await getImageSize(uri);
    const longestSide = Math.max(width, height);
    const actions =
      longestSide > 2048
        ? [width >= height ? { resize: { width: 2048 } } : { resize: { height: 2048 } }]
        : [];

    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    const compressed = result.base64 || null;
    if (compressed) {
      console.log(
        `[compressForStorage] ${(compressed.length * 0.75 / 1024).toFixed(0)} KB` +
        ` (original longest side: ${longestSide}px)`
      );
    }
    return compressed;
  } catch (err) {
    console.error("[compressForStorage] Compression failed, falling back to original:", err);
    return null;
  }
}
