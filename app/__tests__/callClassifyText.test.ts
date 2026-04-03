/**
 * @jest-environment node
 */
import { callClassifyText } from "../lib/callClassifyText";

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
  bin_id: "madaffald",
  reason_en: "Coffee filters are organic waste and belong in food waste.",
  reason_da: "Kaffefiltre er organisk affald og hører til i madaffald.",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("callClassifyText", () => {
  it("returns ClassifyTextResponse on happy path", async () => {
    mockInvoke.mockResolvedValue({ data: validResponse, error: null });
    const result = await callClassifyText("coffee filter");
    expect(result).toEqual(validResponse);
    expect(mockInvoke).toHaveBeenCalledWith("classify-text", {
      body: { item: "coffee filter" },
      signal: expect.any(AbortSignal),
    });
  });

  it("throws when Edge Function returns an error", async () => {
    const err = new Error("upstream error");
    mockInvoke.mockResolvedValue({ data: null, error: err });
    await expect(callClassifyText("coffee filter")).rejects.toThrow("upstream error");
  });

  it("throws when data is null and no error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await expect(callClassifyText("coffee filter")).rejects.toThrow("No data returned");
  });

  it("throws when bin_id is an unrecognised string", async () => {
    mockInvoke.mockResolvedValue({
      data: { ...validResponse, bin_id: "trash-can" },
      error: null,
    });
    await expect(callClassifyText("coffee filter")).rejects.toThrow("Unexpected response shape");
  });

  it("throws when bin_id is a number (not string or null)", async () => {
    mockInvoke.mockResolvedValue({
      data: { ...validResponse, bin_id: 123 },
      error: null,
    });
    await expect(callClassifyText("coffee filter")).rejects.toThrow("Unexpected response shape");
  });

  it("throws when reason_en is not a string", async () => {
    mockInvoke.mockResolvedValue({
      data: { ...validResponse, reason_en: null },
      error: null,
    });
    await expect(callClassifyText("coffee filter")).rejects.toThrow("Unexpected response shape");
  });

  it("throws 'Request timed out' when invoke is aborted", async () => {
    const abortErr = new DOMException("signal is aborted", "AbortError");
    mockInvoke.mockRejectedValue(abortErr);
    await expect(callClassifyText("coffee filter")).rejects.toThrow("Request timed out");
  });

  it("returns successfully when bin_id is null (unclassifiable)", async () => {
    mockInvoke.mockResolvedValue({
      data: { bin_id: null, reason_en: "", reason_da: "" },
      error: null,
    });
    const result = await callClassifyText("asdfgh");
    expect(result.bin_id).toBeNull();
  });
});
