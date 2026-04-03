import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Compress aggressively for the identify call.
 * ~800px longest side, 60% JPEG quality — reduces a typical phone photo
 * from 3-5 MB to ~50-100 KB. GPT-4o-mini uses detail:"low" (512x512) so
 * sending anything bigger is wasted bandwidth.
 *
 * Returns compressed base64, or null if compression fails (caller should
 * fall back to the original base64).
 */
export async function compressForIdentify(uri: string): Promise<string | null> {
  try {
    const { width, height } = await getImageSize(uri);
    const resizeAction =
      width >= height ? { resize: { width: 800 } } : { resize: { height: 800 } };

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [resizeAction],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return result.base64 ?? null;
  } catch (err) {
    console.warn("[compressForIdentify] Compression failed, falling back to original:", err);
    return null;
  }
}

/**
 * Compress minimally for Supabase Storage (training set).
 * ~2048px longest side, 85% JPEG quality — preserves most detail while
 * significantly reducing file size vs full device resolution.
 *
 * Returns compressed base64, or null if compression fails (caller should
 * fall back to the original base64).
 */
export async function compressForStorage(uri: string): Promise<string | null> {
  try {
    const { width, height } = await getImageSize(uri);
    const resizeAction =
      width >= height ? { resize: { width: 2048 } } : { resize: { height: 2048 } };

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [resizeAction],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return result.base64 ?? null;
  } catch (err) {
    console.warn("[compressForStorage] Compression failed, falling back to original:", err);
    return null;
  }
}
