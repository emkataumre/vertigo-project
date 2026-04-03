import type { BinId } from "../constants/bins";

/**
 * JSON shape returned by the `identify` Supabase Edge Function.
 * Must stay structurally identical to IdentifyResponse in
 * supabase/functions/identify/index.ts.
 */
export interface IdentifyResponse {
  item: string;
  bin_id: BinId | null;
  reason_en: string;
  reason_da: string;
  alternatives: { item: string; bin_id: BinId }[];
}
