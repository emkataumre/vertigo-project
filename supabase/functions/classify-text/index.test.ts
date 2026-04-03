import {
  assertClassifyTextResponse,
  isRateLimited,
  rateLimitMap,
} from "./index.ts";
import { assertEquals, assertThrows } from "@std/assert";

const validRaw = {
  bin_id: "madaffald",
  reason_en: "Coffee filters are organic waste and belong in food waste.",
  reason_da: "Kaffefiltre er organisk affald og hører til i madaffald.",
};

// ─── assertClassifyTextResponse ───────────────────────────────────────────────

Deno.test("assertClassifyTextResponse: returns valid response", () => {
  const result = assertClassifyTextResponse(validRaw);
  assertEquals(result.bin_id, "madaffald");
  assertEquals(result.reason_en, validRaw.reason_en);
  assertEquals(result.reason_da, validRaw.reason_da);
});

Deno.test("assertClassifyTextResponse: accepts bin_id null (unclassifiable)", () => {
  const result = assertClassifyTextResponse({ ...validRaw, bin_id: null, reason_en: "", reason_da: "" });
  assertEquals(result.bin_id, null);
});

Deno.test("assertClassifyTextResponse: accepts empty reason strings when bin_id is null", () => {
  const result = assertClassifyTextResponse({ bin_id: null, reason_en: "", reason_da: "" });
  assertEquals(result.reason_en, "");
  assertEquals(result.reason_da, "");
});

Deno.test("assertClassifyTextResponse: throws on non-object input (null)", () => {
  assertThrows(
    () => assertClassifyTextResponse(null),
    Error,
    "OpenAI response is not an object"
  );
});

Deno.test("assertClassifyTextResponse: throws on non-object input (string)", () => {
  assertThrows(
    () => assertClassifyTextResponse("hello"),
    Error,
    "OpenAI response is not an object"
  );
});

Deno.test("assertClassifyTextResponse: throws on invalid bin_id string", () => {
  assertThrows(
    () => assertClassifyTextResponse({ ...validRaw, bin_id: "trash-can" }),
    Error,
    "Invalid bin_id from model"
  );
});

Deno.test("assertClassifyTextResponse: throws when reason_en is missing", () => {
  const { reason_en: _reason_en, ...rest } = validRaw;
  assertThrows(
    () => assertClassifyTextResponse(rest),
    Error,
    "reason_en is missing or not a string"
  );
});

Deno.test("assertClassifyTextResponse: throws when reason_da is missing", () => {
  const { reason_da: _reason_da, ...rest } = validRaw;
  assertThrows(
    () => assertClassifyTextResponse(rest),
    Error,
    "reason_da is missing or not a string"
  );
});

Deno.test("assertClassifyTextResponse: throws when reason_en is not a string", () => {
  assertThrows(
    () => assertClassifyTextResponse({ ...validRaw, reason_en: 42 }),
    Error,
    "reason_en is missing or not a string"
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

  const expiredTimestamps = Array.from({ length: 10 }, (_, i) =>
    Date.now() - WINDOW_MS - 1000 - i
  );
  rateLimitMap.set(ip, expiredTimestamps);

  assertEquals(isRateLimited(ip), false);
});
