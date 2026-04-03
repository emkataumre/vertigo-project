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
// Must stay structurally identical to ClassifyTextResponse in app/types/classifyText.ts.
interface ClassifyTextResponse {
  bin_id: BinId | null;
  reason_en: string;
  reason_da: string;
}

// ─── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are a waste sorting assistant for Copenhagen (Københavns Kommune), Denmark.

Your only job is to classify a waste item described by name into exactly one of the following ${VALID_BIN_IDS.size} bin categories defined by Københavns Kommune.

The item name may be provided in any language (English, Danish, or other). Understand it regardless of language.

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
- If the item name is gibberish, too vague to classify, or does not correspond to a real waste item, set bin_id to null.

RESPONSE FORMAT:
Respond with a single JSON object — no markdown, no prose, no code fences. Exactly these three keys:
{
  "bin_id": "<one of the ${VALID_BIN_IDS.size} IDs above, or null if unclassifiable>",
  "reason_en": "<1–2 sentence explanation in English of why this bin was chosen, or empty string if bin_id is null>",
  "reason_da": "<same explanation in Danish, or empty string if bin_id is null>"
}

CONSTRAINTS:
- bin_id MUST be one of the ${VALID_BIN_IDS.size} IDs listed above, or null. Any other value is a hard error.
- reason_en and reason_da must always be present strings (empty string is allowed only when bin_id is null).
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
  },
  required: ["bin_id", "reason_en", "reason_da"],
  additionalProperties: false,
};

// ─── OpenAI client ────────────────────────────────────────────────────────────
const openai = import.meta.main
  ? new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") ?? "" })
  : (null as unknown as OpenAI);

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

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

function assertClassifyTextResponse(raw: unknown): ClassifyTextResponse {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("OpenAI response is not an object");
  }
  const r = raw as Record<string, unknown>;

  if (!isValidBinIdOrNull(r.bin_id)) {
    throw new Error(`Invalid bin_id from model: ${JSON.stringify(r.bin_id)}`);
  }
  if (typeof r.reason_en !== "string") {
    throw new Error("reason_en is missing or not a string");
  }
  if (typeof r.reason_da !== "string") {
    throw new Error("reason_da is missing or not a string");
  }

  return {
    bin_id: r.bin_id as BinId | null,
    reason_en: r.reason_en,
    reason_da: r.reason_da,
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
    ? forwarded.split(",").map((s) => s.trim()).filter(Boolean).at(-1) ?? "unknown"
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
  let body: { item?: unknown };
  try {
    body = await req.json() as { item?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: "Request body must be valid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (typeof body.item !== "string" || body.item.trim() === "") {
    return new Response(JSON.stringify({ error: "Missing or empty item field" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Guard against oversized text payloads that would waste LLM tokens.
  if (body.item.length > 500) {
    return new Response(JSON.stringify({ error: "Item name is too long — please use a short description (max 500 characters)" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const item = body.item.trim();

  // ── Call OpenAI ─────────────────────────────────────────────────────────────
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("[classify-text] CRITICAL: OPENAI_API_KEY environment variable is not set — all requests will fail");
    return new Response(JSON.stringify({ error: "Service configuration error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "classify_text_response",
          strict: true,
          schema: RESPONSE_JSON_SCHEMA,
        },
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Which Copenhagen bin does this item belong in? Item: "${item}"` },
      ],
    });
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      console.error(
        `[classify-text] OpenAI API error: status=${err.status} code=${err.code} message=${err.message}`
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
    console.error("[classify-text] Unexpected error calling OpenAI:", err);
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
    console.error("[classify-text] OpenAI returned an empty choices array");
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
      `[classify-text] Model returned null content; finish_reason=${choice.finish_reason}`
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
      `[classify-text] Model returned empty string content; finish_reason=${choice.finish_reason}`
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
      console.error("[classify-text] Failed to parse model response as JSON; rawContent:", rawContent);
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
  let result: ClassifyTextResponse;
  try {
    result = assertClassifyTextResponse(parsed);
  } catch (err) {
    const validationMessage = err instanceof Error ? err.message : String(err);
    console.error(
      `[classify-text] Model response failed validation: ${validationMessage}; rawContent:`,
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
export { assertClassifyTextResponse, isRateLimited, isValidBinIdOrNull, VALID_BIN_IDS, rateLimitMap };
