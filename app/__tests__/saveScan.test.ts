/**
 * @jest-environment node
 */
import { saveScan } from "../lib/saveScan";

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockInsert = jest.fn();

jest.mock("../lib/supabase", () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
    from: jest.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

const validResponse = {
  item: "Coffee filter",
  bin_id: "madaffald" as const,
  reason_en: "Used coffee filters go in food waste.",
  reason_da: "Brugte kaffefiltre hører til i madaffald.",
  alternatives: [{ item: "Coffee bag", bin_id: "restaffald" as const }],
};

// Minimal valid base64 (1x1 white JPEG)
const validBase64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U" +
  "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN" +
  "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
  "MjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

beforeEach(() => {
  jest.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://test.co/photo.jpg" } });
  mockInsert.mockResolvedValue({ error: null });
});

describe("saveScan", () => {
  it("uploads photo and inserts scan record on happy path", async () => {
    await saveScan("file://photo.jpg", validBase64, validResponse);

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^scans\/\d+-\w+\.jpg$/),
      expect.any(Uint8Array),
      { contentType: "image/jpeg" }
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        photo_url: "https://test.co/photo.jpg",
        item: "Coffee filter",
        bin_id: "madaffald",
        reason_en: validResponse.reason_en,
        reason_da: validResponse.reason_da,
        alternative_bin_id: "restaffald",
        alternatives: validResponse.alternatives,
      })
    );
  });

  it("logs error and skips insert when upload fails", async () => {
    mockUpload.mockResolvedValue({ error: new Error("storage error") });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await saveScan("file://photo.jpg", validBase64, validResponse);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[saveScan]"),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });

  it("logs error but does not throw when insert fails", async () => {
    mockInsert.mockResolvedValue({ error: new Error("db error") });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(saveScan("file://photo.jpg", validBase64, validResponse)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[saveScan]"),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });

  it("sets alternative_bin_id to null when alternatives array is empty", async () => {
    const responseNoAlts = { ...validResponse, alternatives: [] };
    await saveScan("file://photo.jpg", validBase64, responseNoAlts);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        alternative_bin_id: null,
        alternatives: [],
      })
    );
  });

  it("catches and logs error on invalid base64 without throwing", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(saveScan("file://photo.jpg", "!!!invalid!!!", validResponse)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
