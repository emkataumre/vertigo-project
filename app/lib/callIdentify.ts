import { supabase } from "./supabase";
import type { IdentifyResponse } from "../types/identify";

export async function callIdentify(imageBase64: string): Promise<IdentifyResponse> {
  const { data, error } = await supabase.functions.invoke<IdentifyResponse>("identify", {
    body: { image_base64: imageBase64 },
  });
  if (error) throw error;
  if (!data) throw new Error("No data returned from identify function");
  if (!Array.isArray(data.alternatives) || (data.bin_id !== null && typeof data.bin_id !== "string")) {
    throw new Error("Unexpected response shape from identify function");
  }
  return data;
}
