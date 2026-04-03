import { supabase } from "./supabase";
import { withRetry } from "./retry";
import type { IdentifyResponse } from "../types/identify";

/**
 * Fire-and-forget background save. Never rejects.
 * Errors are retried with back-off. All errors are caught and logged internally.
 */
export async function saveScan(
  photoUri: string,
  photoBase64: string,
  result: IdentifyResponse
): Promise<void> {
  try {
    await withRetry(async () => {
      // Convert base64 captured by the camera to bytes for upload
      const bytes = Uint8Array.from(atob(photoBase64), (c) => c.charCodeAt(0));

      const path = `scans/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, bytes, { contentType: "image/jpeg" });
      // Note: if upload succeeds but insert fails below, the retry will re-upload under a new path.
      // The first file becomes orphaned in storage. Harmless — can be batch-cleaned later.
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      const { error: insertError } = await supabase.from("scans").insert({
        photo_url: photoUrl,
        item: result.item,
        bin_id: result.bin_id,
        reason_en: result.reason_en,
        reason_da: result.reason_da,
        alternative_bin_id: result.alternatives[0]?.bin_id ?? null,
        alternatives: result.alternatives,
      });
      if (insertError) throw insertError;
    }, "saveScan");
  } catch (err) {
    console.error("[saveScan] Failed permanently after retries for item:", result.item, err);
  }
}
