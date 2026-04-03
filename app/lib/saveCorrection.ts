import { supabase } from "./supabase";

/**
 * Fire-and-forget background save of a user correction. Never rejects.
 * All errors are caught and logged internally.
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
    const bytes = Uint8Array.from(atob(photoBase64), (c) => c.charCodeAt(0));

    const path = `corrections/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, bytes, { contentType: "image/jpeg" });

    if (uploadError) {
      console.error("[saveCorrection] Storage upload failed:", uploadError);
      return;
    }

    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
    const photoUrl = urlData.publicUrl;

    const { error: insertError } = await supabase.from("corrections").insert({
      photo_url: photoUrl,
      predicted_item: predictedItem,
      predicted_bin_id: predictedBinId,
      corrected_item: correctedItem,
      corrected_bin_id: correctedBinId,
    });

    if (insertError) {
      console.error("[saveCorrection] DB insert failed:", insertError);
    }
  } catch (err) {
    console.error("[saveCorrection] Unexpected error:", err);
  }
}
