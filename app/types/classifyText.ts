import type { BinId } from "../constants/bins";

/**
 * JSON shape returned by the `classify-text` Supabase Edge Function.
 * Must stay structurally identical to ClassifyTextResponse in
 * supabase/functions/classify-text/index.ts.
 */
export interface ClassifyTextResponse {
  bin_id: BinId | null;
  reason_en: string;
  reason_da: string;
}
