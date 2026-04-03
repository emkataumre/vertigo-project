import { supabase } from "./supabase";
import { withRetry } from "./retry";

/**
 * Fire-and-forget background save of a user correction. Never rejects.
 * Errors are retried with back-off. All errors are caught and logged internally.
 */
export async function saveCorrection(
  photoUri: string,
  photoBase64: string,
  predictedItem: string,
  predictedBinId: string | null,
  correctedItem: string,
  correctedBinId: string | null
): Promise<void> {
  try {
    await withRetry(async () => {
      const bytes = Uint8Array.from(atob(photoBase64), (c) => c.charCodeAt(0));

      const path = `corrections/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, bytes, { contentType: "image/jpeg" });
      // Note: if upload succeeds but insert fails below, the retry will re-upload under a new path.
      // The first file becomes orphaned in storage. Harmless — can be batch-cleaned later.
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      const { error: insertError } = await supabase.from("corrections").insert({
        photo_url: photoUrl,
        predicted_item: predictedItem,
        predicted_bin_id: predictedBinId,
        corrected_item: correctedItem,
        corrected_bin_id: correctedBinId,
      });
      if (insertError) throw insertError;
    }, "saveCorrection");
  } catch (err) {
    console.error("[saveCorrection] Failed permanently after retries. predictedItem:", predictedItem, "correctedItem:", correctedItem, err);
  }
}
