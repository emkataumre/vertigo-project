// Deno runtime — do NOT use Node.js imports.
import OpenAI from "@openai/openai";

// ─── Copenhagen taxonomy ───────────────────────────────────────────────────────
// Duplicated from app/constants/bins.ts — Edge Functions cannot import from the app layer.
// When bin IDs change in bins.ts, update ALL THREE of the following:
//   (1) VALID_BIN_IDS set below
//   (2) BinId union type below
//   (3) the VALID BIN IDs list in SYSTEM_PROMPT
const VALID_BIN_IDS = new Set([
  "madaffald",
  "plast",
  "mad-og-drikkekartoner",
  "papir",
  "restaffald",
  "metal",
  "pap",
  "glas",
  "elektronik",
  "farligt-affald",
  "medicin",
  "stort-indbo",
  "haveaffald",
  "batterier",
  "tekstilaffald",
  "indendoers-trae",
]);

type BinId =
  | "madaffald"
  | "plast"
  | "mad-og-drikkekartoner"
  | "papir"
  | "restaffald"
  | "metal"
  | "pap"
  | "glas"
  | "elektronik"
  | "farligt-affald"
  | "medicin"
  | "stort-indbo"
  | "haveaffald"
  | "batterier"
  | "tekstilaffald"
  | "indendoers-trae";

// ─── Response shape ────────────────────────────────────────────────────────────
// Must stay structurally identical to IdentifyResponse in app/types/identify.ts.
interface IdentifyResponse {
  item: string;
  bin_id: BinId | null;
  reason_en: string;
  reason_da: string;
  alternatives: { item: string; bin_id: BinId }[];
}

// ─── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are a waste sorting assistant for Copenhagen (Københavns Kommune), Denmark.

Your only job is to classify the waste item visible in the provided photo into exactly one of the following ${VALID_BIN_IDS.size} bin categories defined by Københavns Kommune.

VALID BIN IDs (use these exact strings — no others are permitted):
- madaffald        (Food Waste)
- plast            (Plastic)
- mad-og-drikkekartoner  (Food & Drink Cartons)
- papir            (Paper)
- restaffald       (Residual Waste)
- metal            (Metal)
- pap              (Cardboard)
- glas             (Glass)
- elektronik       (Electronics — anything with a cable, battery, or solar cell)
- farligt-affald   (Hazardous Waste)
- medicin          (Medicine — must be handed to a pharmacy)
- stort-indbo      (Large Household Items)
- haveaffald       (Garden Waste)
- batterier        (Batteries)
- tekstilaffald    (Textile Waste — must be washed, dry, and bagged with a knot)
- indendoers-trae  (Indoor Wood — no impregnated wood)

SORTING RULES (Copenhagen-specific):
- Plastic (plast) and food & drink cartons (mad-og-drikkekartoner) share the same physical bin — they are still distinct categories; classify to the correct one.
- Food waste (madaffald) must go in the supplied green bio bags.
- Medicine (medicin) is never placed in a bin — it must be handed to pharmacy staff.
- Batteries larger than 500 g go to a recycling station, not the batterier bin.
- Garden waste (haveaffald) is only collected 1 March – 30 November.
- Indoor wood (indendoers-trae): impregnated, painted, or outdoor wood does NOT qualify — use restaffald or farligt-affald as appropriate.
- Electronics (elektronik): if a device contains a battery (e.g. a remote control), classify as elektronik, not batterier.
- If nothing can be identified in the image (blurry, dark, no item visible), set bin_id to null.

RESPONSE FORMAT:
Respond with a single JSON object — no markdown, no prose, no code fences. Exactly these five keys:
{
  "item": "<short common name of the item visible in the photo, in English>",
  "bin_id": "<one of the ${VALID_BIN_IDS.size} IDs above, or null if unidentifiable>",
  "reason_en": "<1–2 sentence explanation in English of why this bin was chosen>",
  "reason_da": "<same explanation in Danish>",
  "alternatives": [{ "item": "<alternative item name>", "bin_id": "<valid bin ID>" }]
}

CONSTRAINTS:
- item MUST be a short, common English name for the item (e.g. "Coffee filter", "Plastic bottle"). If the image is unidentifiable, use "Unknown item".
- bin_id MUST be one of the ${VALID_BIN_IDS.size} IDs listed above, or null. Any other value is a hard error.
- alternatives MUST be an array of exactly 2–3 objects when bin_id is not null, or an empty array [] when bin_id is null (unidentifiable). Each alternative represents a plausible different item the user might be holding that belongs in a different bin — these help the user self-correct if the primary identification is wrong. Each alternative must have an "item" (string) and a "bin_id" that is DIFFERENT from the primary bin_id.
- reason_en and reason_da must both always be present and non-empty strings.
- Do not hallucinate bin IDs. Do not invent categories not in the list above.
`.trim();

// ─── JSON Schema for structured output ────────────────────────────────────────
// JSON Schema requires an array for enum — spread Set to avoid duplicating the source data.
const BIN_ID_ENUM = [...VALID_BIN_IDS];

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    item: { type: "string" },
    bin_id: {
      anyOf: [
        { type: "string", enum: BIN_ID_ENUM },
        { type: "null" },
      ],
    },
    reason_en: { type: "string" },
    reason_da: { type: "string" },
    alternatives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          bin_id: { type: "string", enum: BIN_ID_ENUM },
        },
        required: ["item", "bin_id"],
        additionalProperties: false,
      },
    },
  },
  required: ["item", "bin_id", "reason_en", "reason_da", "alternatives"],
  additionalProperties: false,
};

// ─── OpenAI client ────────────────────────────────────────────────────────────
// Constructed at module scope so it is built once on cold start, not per request.
// Guarded by import.meta.main so test imports don't require env access.
const openai = import.meta.main
  ? new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") ?? "" })
  : (null as unknown as OpenAI);

// ─── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory sliding window rate limiter — see RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_MS below.
// NOTE: resets on cold start and is not coordinated across multiple Edge Function instances.
// Acceptable for now — revisit if abuse becomes a problem.
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Get existing timestamps, filter out those outside the window.
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

  // Periodically purge IPs with no recent requests to avoid memory growth.
  if (Math.random() < 0.01) {
    for (const [key, ts] of rateLimitMap.entries()) {
      if (ts.every((t) => t <= windowStart)) {
        rateLimitMap.delete(key);
      }
    }
  }

  return false;
}

// ─── CORS headers ──────────────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Runtime validation ────────────────────────────────────────────────────────
function isValidBinIdOrNull(value: unknown): value is BinId | null {
  return value === null || (typeof value === "string" && VALID_BIN_IDS.has(value));
}

function assertIdentifyResponse(raw: unknown): IdentifyResponse {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("OpenAI response is not an object");
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.item !== "string" || r.item.trim() === "") {
    throw new Error("item is missing or empty");
  }
  if (!isValidBinIdOrNull(r.bin_id)) {
    throw new Error(`Invalid bin_id from model: ${JSON.stringify(r.bin_id)}`);
  }
  if (typeof r.reason_en !== "string" || r.reason_en.trim() === "") {
    throw new Error("reason_en is missing or empty");
  }
  if (typeof r.reason_da !== "string" || r.reason_da.trim() === "") {
    throw new Error("reason_da is missing or empty");
  }
  if (!Array.isArray(r.alternatives)) {
    throw new Error("alternatives is missing or not an array");
  }
  const alternatives: { item: string; bin_id: BinId }[] = [];
  for (const alt of r.alternatives) {
    if (typeof alt !== "object" || alt === null) {
      throw new Error("alternatives entry is not an object");
    }
    const a = alt as Record<string, unknown>;
    if (typeof a.item !== "string" || a.item.trim() === "") {
      throw new Error("alternatives entry has missing or empty item");
    }
    if (typeof a.bin_id !== "string" || !VALID_BIN_IDS.has(a.bin_id)) {
      throw new Error(`Invalid bin_id in alternatives: ${JSON.stringify(a.bin_id)}`);
    }
    alternatives.push({ item: a.item, bin_id: a.bin_id as BinId });
  }

  return {
    item: r.item,
    bin_id: r.bin_id as BinId | null,
    reason_en: r.reason_en,
    reason_da: r.reason_da,
    alternatives,
  };
}

// ─── Entry point ───────────────────────────────────────────────────────────────
if (import.meta.main) Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const forwarded = req.headers.get("x-forwarded-for");
  const clientIp = forwarded
    ? forwarded.split(",").map(s => s.trim()).filter(Boolean).at(-1) ?? "unknown"
    : "unknown";
  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Too many requests — please wait before trying again" }),
      {
        status: 429,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  // ── Parse request body ──────────────────────────────────────────────────────
  let body: { image_base64?: unknown };
  try {
    body = await req.json() as { image_base64?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: "Request body must be valid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (typeof body.image_base64 !== "string" || body.image_base64.trim() === "") {
    return new Response(JSON.stringify({ error: "Missing or empty image_base64 field" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  // ~5 KB minimum decoded size (5120 bytes × 4/3 ≈ 6828 base64 chars).
  // Rejects degenerate blobs that the model cannot meaningfully classify.
  if (body.image_base64.length < 6828) {
    return new Response(
      JSON.stringify({ error: "Image is too small to classify — please send a real photo" }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
  // ~15 MB maximum decoded size (15_000_000 bytes × 4/3 ≈ 20_000_000 base64 chars).
  // Rejects oversized payloads that would waste bandwidth and model tokens.
  if (body.image_base64.length > 20_000_000) {
    return new Response(
      JSON.stringify({ error: "Image is too large — please send a photo under 15 MB" }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  const imageBase64 = body.image_base64;

  // ── Call OpenAI ─────────────────────────────────────────────────────────────
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("[identify] CRITICAL: OPENAI_API_KEY environment variable is not set — all requests will fail");
    return new Response(JSON.stringify({ error: "Service configuration error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── OpenAI API call ─────────────────────────────────────────────────────────
  let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "identify_response",
          strict: true,
          schema: RESPONSE_JSON_SCHEMA,
        },
      },
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                // Only JPEG is accepted — the app captures in JPEG format via expo-camera.
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: "Which Copenhagen bin does this item belong in?",
            },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      console.error(
        `[identify] OpenAI API error: status=${err.status} code=${err.code} message=${err.message}`
      );
      if (err.status === 429) {
        return new Response(
          JSON.stringify({ error: "Classification failed — upstream rate limit" }),
          {
            status: 429,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({ error: "Classification failed — upstream API error" }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
    console.error("[identify] Unexpected error calling OpenAI:", err);
    return new Response(
      JSON.stringify({ error: "Classification failed — unexpected error" }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  // ── Validate completion shape ────────────────────────────────────────────────
  if (completion.choices.length === 0) {
    console.error("[identify] OpenAI returned an empty choices array");
    return new Response(
      JSON.stringify({ error: "Classification failed — no response from model" }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  const choice = completion.choices[0];
  if (choice.message.content === null) {
    console.error(
      `[identify] Model returned null content; finish_reason=${choice.finish_reason}`
    );
    return new Response(
      JSON.stringify({ error: "Classification failed — model returned no content" }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  const rawContent = choice.message.content;
  if (rawContent === "") {
    console.error(
      `[identify] Model returned empty string content; finish_reason=${choice.finish_reason}`
    );
    return new Response(
      JSON.stringify({ error: "Classification failed — model returned empty content" }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  // ── Parse JSON ───────────────────────────────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("[identify] Failed to parse model response as JSON; rawContent:", rawContent);
      return new Response(
        JSON.stringify({ error: "Classification failed — malformed model response" }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
    throw err;
  }

  // ── Validate response shape ──────────────────────────────────────────────────
  let result: IdentifyResponse;
  try {
    result = assertIdentifyResponse(parsed);
  } catch (err) {
    const validationMessage = err instanceof Error ? err.message : String(err);
    console.error(
      `[identify] Model response failed validation: ${validationMessage}; rawContent:`,
      rawContent
    );
    return new Response(
      JSON.stringify({ error: "Classification failed — unexpected model output" }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});

// ─── Exports for testing ───────────────────────────────────────────────────────
export { assertIdentifyResponse, isRateLimited, isValidBinIdOrNull, VALID_BIN_IDS, rateLimitMap };
