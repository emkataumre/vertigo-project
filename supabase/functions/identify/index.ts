// Deno runtime — do NOT use Node.js imports.
import OpenAI from "jsr:@openai/openai";

// ─── Copenhagen taxonomy ───────────────────────────────────────────────────────
// Duplicated from app/constants/bins.ts — Edge Functions cannot import from the
// app layer. Keep in sync with app/constants/bins.ts manually whenever bin IDs change.
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
  bin_id: BinId | null;
  reason_en: string;
  reason_da: string;
  alternative_bin_id: BinId | null;
}

// ─── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are a waste sorting assistant for Copenhagen (Københavns Kommune), Denmark.

Your only job is to classify the waste item visible in the provided photo into exactly one of the following 16 bin categories defined by Københavns Kommune.

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
Respond with a single JSON object — no markdown, no prose, no code fences. Exactly these four keys:
{
  "bin_id": "<one of the 16 IDs above, or null if unidentifiable>",
  "reason_en": "<1–2 sentence explanation in English of why this bin was chosen>",
  "reason_da": "<same explanation in Danish>",
  "alternative_bin_id": "<a second valid ID only if this is a genuine close call, otherwise null>"
}

CONSTRAINTS:
- bin_id MUST be one of the 16 IDs listed above, or null. Any other value is a hard error.
- alternative_bin_id MUST be one of the 16 IDs listed above, or null. Only set it when there is meaningful ambiguity. Do not set it for routine classifications.
- reason_en and reason_da must both always be present and non-empty strings.
- Do not hallucinate bin IDs. Do not invent categories not in the list above.
`.trim();

// ─── JSON Schema for structured output ────────────────────────────────────────
const BIN_ID_ENUM = [...VALID_BIN_IDS];

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    bin_id: {
      anyOf: [
        { type: "string", enum: BIN_ID_ENUM },
        { type: "null" },
      ],
    },
    reason_en: { type: "string" },
    reason_da: { type: "string" },
    alternative_bin_id: {
      anyOf: [
        { type: "string", enum: BIN_ID_ENUM },
        { type: "null" },
      ],
    },
  },
  required: ["bin_id", "reason_en", "reason_da", "alternative_bin_id"],
  additionalProperties: false,
};

// ─── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory sliding window: 10 requests per IP per 60 seconds.
// NOTE: This map resets on every cold start and is not coordinated across
// multiple Edge Function instances. Acceptable for now — revisit if abuse
// becomes a problem.
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

  if (!isValidBinIdOrNull(r.bin_id)) {
    throw new Error(`Invalid bin_id from model: ${JSON.stringify(r.bin_id)}`);
  }
  if (typeof r.reason_en !== "string" || r.reason_en.trim() === "") {
    throw new Error("reason_en is missing or empty");
  }
  if (typeof r.reason_da !== "string" || r.reason_da.trim() === "") {
    throw new Error("reason_da is missing or empty");
  }
  if (!isValidBinIdOrNull(r.alternative_bin_id)) {
    throw new Error(
      `Invalid alternative_bin_id from model: ${JSON.stringify(r.alternative_bin_id)}`
    );
  }

  return {
    bin_id: r.bin_id as BinId | null,
    reason_en: r.reason_en,
    reason_da: r.reason_da,
    alternative_bin_id: r.alternative_bin_id as BinId | null,
  };
}

// ─── Entry point ───────────────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
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
  const clientIp = req.headers.get("x-forwarded-for") ?? "unknown";
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
  let imageBase64: string;
  try {
    const body = await req.json() as { image_base64?: unknown };
    if (typeof body.image_base64 !== "string" || body.image_base64.trim() === "") {
      throw new Error("Missing or empty image_base64 field");
    }
    // ~5 KB minimum decoded size (5120 bytes × 4/3 ≈ 6828 base64 chars).
    // Rejects degenerate blobs that the model cannot meaningfully classify.
    if (body.image_base64.length < 6828) {
      throw new Error("Image is too small to classify — please send a real photo");
    }
    // ~15 MB maximum decoded size (15_000_000 bytes × 4/3 ≈ 20_000_000 base64 chars).
    // Rejects oversized payloads that would waste bandwidth and model tokens.
    if (body.image_base64.length > 20_000_000) {
      throw new Error("Image is too large — please send a photo under 15 MB");
    }
    imageBase64 = body.image_base64;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request body";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Call OpenAI ─────────────────────────────────────────────────────────────
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const openai = new OpenAI({ apiKey });

  let result: IdentifyResponse;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
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

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("Empty response from model");
    }

    result = assertIdentifyResponse(JSON.parse(rawContent));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[identify] OpenAI error:", detail);
    return new Response(JSON.stringify({ error: "Classification failed" }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
