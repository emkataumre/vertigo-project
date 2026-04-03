/**
 * @jest-environment node
 */
import { callIdentify } from "../lib/callIdentify";

jest.mock("../lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

import { supabase } from "../lib/supabase";

const mockInvoke = supabase.functions.invoke as jest.Mock;

const validResponse = {
  item: "Coffee filter",
  bin_id: "madaffald",
  reason_en: "Used coffee filters go in food waste.",
  reason_da: "Brugte kaffefiltre hører til i madaffald.",
  alternatives: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("callIdentify", () => {
  it("returns IdentifyResponse on happy path", async () => {
    mockInvoke.mockResolvedValue({ data: validResponse, error: null });
    const result = await callIdentify("base64string");
    expect(result).toEqual(validResponse);
    expect(mockInvoke).toHaveBeenCalledWith("identify", {
      body: { image_base64: "base64string" },
    });
  });

  it("throws when Edge Function returns an error", async () => {
    const err = new Error("upstream error");
    mockInvoke.mockResolvedValue({ data: null, error: err });
    await expect(callIdentify("base64string")).rejects.toThrow("upstream error");
  });

  it("throws when data is null and no error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await expect(callIdentify("base64string")).rejects.toThrow("No data returned");
  });

  it("throws when alternatives is not an array", async () => {
    mockInvoke.mockResolvedValue({
      data: { ...validResponse, alternatives: null },
      error: null,
    });
    await expect(callIdentify("base64string")).rejects.toThrow("Unexpected response shape");
  });

  it("throws when bin_id is a number (not string or null)", async () => {
    mockInvoke.mockResolvedValue({
      data: { ...validResponse, bin_id: 123 },
      error: null,
    });
    await expect(callIdentify("base64string")).rejects.toThrow("Unexpected response shape");
  });

  it("returns successfully when bin_id is null (unidentifiable)", async () => {
    mockInvoke.mockResolvedValue({
      data: { ...validResponse, bin_id: null },
      error: null,
    });
    const result = await callIdentify("base64string");
    expect(result.bin_id).toBeNull();
  });
});
