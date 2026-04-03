/**
 * @jest-environment node
 */
import { saveCorrection } from "../lib/saveCorrection";
import { withRetry } from "../lib/retry";

// Bypass retry logic — save tests focus on save behavior, not retry behavior
jest.mock("../lib/retry", () => ({
  withRetry: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

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

describe("saveCorrection", () => {
  it("uploads photo and inserts correction record on happy path", async () => {
    await saveCorrection("file://photo.jpg", validBase64, "Plastic bottle", "plast", "Glass bottle", "glas");

    expect(jest.mocked(withRetry)).toHaveBeenCalledWith(expect.any(Function), "saveCorrection");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^corrections\/\d+-\w+\.jpg$/),
      expect.any(Uint8Array),
      { contentType: "image/jpeg" }
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        photo_url: "https://test.co/photo.jpg",
        predicted_item: "Plastic bottle",
        predicted_bin_id: "plast",
        corrected_item: "Glass bottle",
        corrected_bin_id: "glas",
      })
    );
  });

  it("logs error and skips insert when upload fails", async () => {
    mockUpload.mockResolvedValue({ error: new Error("storage error") });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await saveCorrection("file://photo.jpg", validBase64, "Plastic bottle", "plast", "Glass bottle", "glas");

    expect(mockInsert).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[saveCorrection]"),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });

  it("logs error but does not throw when insert fails", async () => {
    mockInsert.mockResolvedValue({ error: new Error("db error") });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      saveCorrection("file://photo.jpg", validBase64, "Plastic bottle", "plast", "Glass bottle", "glas")
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[saveCorrection]"),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });

  it("handles null predicted_bin_id and corrected_bin_id", async () => {
    await saveCorrection("file://photo.jpg", validBase64, "Unknown item", null, "Coffee grounds", null);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        predicted_bin_id: null,
        corrected_bin_id: null,
      })
    );
  });

  it("handles null predicted_bin_id with a known corrected_bin_id", async () => {
    await saveCorrection("file://photo.jpg", validBase64, "Unknown item", null, "Glass bottle", "glas");

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        predicted_bin_id: null,
        corrected_bin_id: "glas",
      })
    );
  });

  it("catches and logs error on invalid base64 without throwing", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      saveCorrection("file://photo.jpg", "!!!invalid!!!", "Plastic bottle", "plast", "Glass bottle", "glas")
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("does not throw when withRetry exhausts all attempts", async () => {
    const retryError = new Error("all retries failed");
    jest.mocked(withRetry).mockRejectedValueOnce(retryError);
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      saveCorrection("file://photo.jpg", validBase64, "Plastic bottle", "plast", "Glass bottle", "glas")
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[saveCorrection]"),
      "Plastic bottle",   // predictedItem
      expect.any(String),
      "Glass bottle",     // correctedItem
      retryError
    );
    consoleSpy.mockRestore();
  });
});
