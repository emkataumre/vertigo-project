import {
  assertIdentifyResponse,
  isRateLimited,
  rateLimitMap,
} from "./index.ts";
import { assertEquals, assertThrows } from "@std/assert";

const validRaw = {
  item: "Coffee filter",
  bin_id: "madaffald",
  reason_en: "Used coffee filters go in food waste.",
  reason_da: "Brugte kaffefiltre hører til i madaffald.",
  alternatives: [],
};

// ─── assertIdentifyResponse ───────────────────────────────────────────────────

Deno.test("assertIdentifyResponse: returns valid response", () => {
  const result = assertIdentifyResponse(validRaw);
  assertEquals(result.item, "Coffee filter");
  assertEquals(result.bin_id, "madaffald");
  assertEquals(result.alternatives, []);
});

Deno.test("assertIdentifyResponse: accepts bin_id null (unidentifiable)", () => {
  const result = assertIdentifyResponse({ ...validRaw, bin_id: null });
  assertEquals(result.bin_id, null);
});

Deno.test("assertIdentifyResponse: accepts non-empty alternatives array", () => {
  const result = assertIdentifyResponse({
    ...validRaw,
    alternatives: [{ item: "Coffee bag", bin_id: "restaffald" }],
  });
  assertEquals(result.alternatives.length, 1);
  assertEquals(result.alternatives[0].bin_id, "restaffald");
});

Deno.test("assertIdentifyResponse: accepts empty alternatives array", () => {
  const result = assertIdentifyResponse({ ...validRaw, alternatives: [] });
  assertEquals(result.alternatives, []);
});

Deno.test("assertIdentifyResponse: throws on non-object input (null)", () => {
  assertThrows(
    () => assertIdentifyResponse(null),
    Error,
    "OpenAI response is not an object"
  );
});

Deno.test("assertIdentifyResponse: throws on non-object input (string)", () => {
  assertThrows(
    () => assertIdentifyResponse("hello"),
    Error,
    "OpenAI response is not an object"
  );
});

Deno.test("assertIdentifyResponse: throws when item is missing", () => {
  const { item: _item, ...rest } = validRaw;
  assertThrows(
    () => assertIdentifyResponse(rest),
    Error,
    "item is missing or empty"
  );
});

Deno.test("assertIdentifyResponse: throws when item is whitespace only", () => {
  assertThrows(
    () => assertIdentifyResponse({ ...validRaw, item: "   " }),
    Error,
    "item is missing or empty"
  );
});

Deno.test("assertIdentifyResponse: throws on invalid bin_id string", () => {
  assertThrows(
    () => assertIdentifyResponse({ ...validRaw, bin_id: "trash-can" }),
    Error,
    "Invalid bin_id from model"
  );
});

Deno.test("assertIdentifyResponse: throws when alternatives is not an array", () => {
  assertThrows(
    () => assertIdentifyResponse({ ...validRaw, alternatives: null }),
    Error,
    "alternatives is missing or not an array"
  );
});

Deno.test("assertIdentifyResponse: throws when alternative has invalid bin_id", () => {
  assertThrows(
    () =>
      assertIdentifyResponse({
        ...validRaw,
        alternatives: [{ item: "Coffee bag", bin_id: "trash-can" }],
      }),
    Error,
    "Invalid bin_id in alternatives"
  );
});

// ─── isRateLimited ────────────────────────────────────────────────────────────

Deno.test("isRateLimited: returns false for requests under the limit", () => {
  rateLimitMap.clear();
  for (let i = 0; i < 9; i++) {
    assertEquals(isRateLimited("1.2.3.4"), false);
  }
});

Deno.test("isRateLimited: returns true on the 10th request within the window", () => {
  rateLimitMap.clear();
  for (let i = 0; i < 10; i++) {
    isRateLimited("5.6.7.8");
  }
  assertEquals(isRateLimited("5.6.7.8"), true);
});

Deno.test("isRateLimited: allows requests again after window expires", () => {
  rateLimitMap.clear();
  const ip = "9.10.11.12";
  const WINDOW_MS = 60_000;

  // Fill the window with timestamps in the past (outside the window)
  const expiredTimestamps = Array.from({ length: 10 }, (_, i) =>
    Date.now() - WINDOW_MS - 1000 - i
  );
  rateLimitMap.set(ip, expiredTimestamps);

  // Next request should NOT be rate limited since all timestamps are expired
  assertEquals(isRateLimited(ip), false);
});
