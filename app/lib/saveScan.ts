import { supabase } from "./supabase";
import type { IdentifyResponse } from "../types/identify";

/**
 * Fire-and-forget background save. Never rejects.
 * All errors are caught and logged internally.
 */
export async function saveScan(
  photoUri: string,
  photoBase64: string,
  result: IdentifyResponse
): Promise<void> {
  try {
    // Convert base64 captured by the camera to bytes for upload
    const bytes = Uint8Array.from(atob(photoBase64), (c) => c.charCodeAt(0));

    // Upload to photos bucket
    const path = `scans/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, bytes, { contentType: "image/jpeg" });

    if (uploadError) {
      console.error("[saveScan] Storage upload failed:", uploadError);
      return;
    }

    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
    const photoUrl = urlData.publicUrl;

    // Insert scan record
    const { error: insertError } = await supabase.from("scans").insert({
      photo_url: photoUrl,
      item: result.item,
      bin_id: result.bin_id,
      reason_en: result.reason_en,
      reason_da: result.reason_da,
      alternative_bin_id: result.alternatives[0]?.bin_id ?? null,
      alternatives: result.alternatives,
    });

    if (insertError) {
      console.error("[saveScan] DB insert failed:", insertError);
    }
  } catch (err) {
    console.error("[saveScan] Unexpected error (file read or encoding):", err);
  }
}
