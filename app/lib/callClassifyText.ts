import { supabase } from "./supabase";
import type { ClassifyTextResponse } from "../types/classifyText";
import { BIN_IDS } from "../constants/bins";

export async function callClassifyText(item: string): Promise<ClassifyTextResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let data: ClassifyTextResponse | null;
  let error: Error | null;
  try {
    const result = await supabase.functions.invoke<ClassifyTextResponse>("classify-text", {
      body: { item },
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
  if (!data) throw new Error("No data returned from classify-text function");
  if (data.bin_id !== null && (typeof data.bin_id !== "string" || !(BIN_IDS as readonly string[]).includes(data.bin_id))) {
    throw new Error("Unexpected response shape from classify-text function");
  }
  if (typeof data.reason_en !== "string" || typeof data.reason_da !== "string") {
    throw new Error("Unexpected response shape from classify-text function");
  }
  return data;
}
