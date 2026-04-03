import { supabase } from "./supabase";
import type { IdentifyResponse } from "../types/identify";

export async function callIdentify(imageBase64: string): Promise<IdentifyResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let data: IdentifyResponse | null;
  let error: Error | null;
  try {
    const result = await supabase.functions.invoke<IdentifyResponse>("identify", {
      body: { image_base64: imageBase64 },
      signal: controller.signal,
    });
    data = result.data;
    error = result.error;
  } catch (err) {
    throw err instanceof DOMException && err.name === "AbortError"
      ? new Error("Request timed out — please try again")
      : err;
  } finally {
    clearTimeout(timeout);
  }
  if (error) throw error;
  if (!data) throw new Error("No data returned from identify function");
  if (!Array.isArray(data.alternatives) || (data.bin_id !== null && typeof data.bin_id !== "string")) {
    throw new Error("Unexpected response shape from identify function");
  }
  return data;
}
