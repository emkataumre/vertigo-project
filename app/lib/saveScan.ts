import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";
import type { IdentifyResponse } from "../types/identify";

export async function saveScan(
  photoUri: string,
  result: IdentifyResponse
): Promise<void> {
  try {
    // Read photo as base64 and convert to Uint8Array for upload
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: "base64",
    });
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

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
      bin_id: result.bin_id,
      reason_en: result.reason_en,
      reason_da: result.reason_da,
      alternative_bin_id: result.alternative_bin_id,
    });

    if (insertError) {
      console.error("[saveScan] DB insert failed:", insertError);
    }
  } catch (err) {
    console.error("[saveScan] Unexpected error (file read or encoding):", err);
  }
}
