/**
 * @jest-environment node
 */
import { compressForIdentify, compressForStorage } from "../lib/compressImage";

const mockManipulateAsync = jest.fn();
const mockGetSize = jest.fn();

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: "jpeg" },
}));

jest.mock("react-native", () => ({
  Image: {
    getSize: (...args: unknown[]) => mockGetSize(...args),
  },
}));

const TEST_URI = "file:///photos/test.jpg";
const COMPRESSED_BASE64 = "compressed_base64_data";

beforeEach(() => {
  jest.clearAllMocks();
  // Default: landscape image (width >= height) → resize by width
  mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
    success(1920, 1080)
  );
});

describe("compressForIdentify", () => {
  it("returns compressed base64 on success", async () => {
    mockManipulateAsync.mockResolvedValue({ base64: COMPRESSED_BASE64, uri: "file:///tmp/out.jpg" });

    const result = await compressForIdentify(TEST_URI);

    expect(result).toBe(COMPRESSED_BASE64);
    expect(mockManipulateAsync).toHaveBeenCalledTimes(1);
    expect(mockManipulateAsync).toHaveBeenCalledWith(
      TEST_URI,
      [{ resize: { width: 800 } }],
      { compress: 0.6, format: "jpeg", base64: true }
    );
  });

  it("resizes by height for portrait images", async () => {
    mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(1080, 1920)
    );
    mockManipulateAsync.mockResolvedValue({ base64: COMPRESSED_BASE64, uri: "file:///tmp/out.jpg" });

    await compressForIdentify(TEST_URI);

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      TEST_URI,
      [{ resize: { height: 800 } }],
      { compress: 0.6, format: "jpeg", base64: true }
    );
  });

  it("returns null when manipulator returns no base64", async () => {
    mockManipulateAsync.mockResolvedValue({ uri: "file:///tmp/out.jpg" });

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await compressForIdentify(TEST_URI);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();

    expect(result).toBeNull();
  });

  it("returns empty string when manipulator returns empty string base64", async () => {
    // "" ?? null evaluates to "" (not null), because "" is not nullish.
    // This test documents that behavior explicitly.
    mockManipulateAsync.mockResolvedValue({ base64: "", uri: "file:///tmp/out.jpg" });

    const result = await compressForIdentify(TEST_URI);

    expect(result).toBe("");
  });

  it("returns null and logs a warning when manipulator throws", async () => {
    mockManipulateAsync.mockRejectedValue(new Error("manipulator error"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await compressForIdentify(TEST_URI);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[compressForIdentify]"),
        expect.anything()
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns null and logs a warning when getSize fails", async () => {
    mockGetSize.mockImplementation(
      (_uri: string, _success: unknown, failure: (err: Error) => void) =>
        failure(new Error("getSize error"))
    );
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await compressForIdentify(TEST_URI);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[compressForIdentify]"),
        expect.anything()
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("compressForStorage", () => {
  it("returns compressed base64 on success", async () => {
    mockManipulateAsync.mockResolvedValue({ base64: COMPRESSED_BASE64, uri: "file:///tmp/out.jpg" });

    const result = await compressForStorage(TEST_URI);

    expect(result).toBe(COMPRESSED_BASE64);
    expect(mockManipulateAsync).toHaveBeenCalledTimes(1);
    expect(mockManipulateAsync).toHaveBeenCalledWith(
      TEST_URI,
      [{ resize: { width: 2048 } }],
      { compress: 0.85, format: "jpeg", base64: true }
    );
  });

  it("resizes by height for portrait images", async () => {
    mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(1080, 1920)
    );
    mockManipulateAsync.mockResolvedValue({ base64: COMPRESSED_BASE64, uri: "file:///tmp/out.jpg" });

    await compressForStorage(TEST_URI);

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      TEST_URI,
      [{ resize: { height: 2048 } }],
      { compress: 0.85, format: "jpeg", base64: true }
    );
  });

  it("returns null when manipulator returns no base64", async () => {
    mockManipulateAsync.mockResolvedValue({ uri: "file:///tmp/out.jpg" });

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await compressForStorage(TEST_URI);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();

    expect(result).toBeNull();
  });

  it("returns empty string when manipulator returns empty string base64", async () => {
    // "" ?? null evaluates to "" (not null), because "" is not nullish.
    // This test documents that behavior explicitly.
    mockManipulateAsync.mockResolvedValue({ base64: "", uri: "file:///tmp/out.jpg" });

    const result = await compressForStorage(TEST_URI);

    expect(result).toBe("");
  });

  it("returns null and logs a warning when manipulator throws", async () => {
    mockManipulateAsync.mockRejectedValue(new Error("manipulator error"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await compressForStorage(TEST_URI);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[compressForStorage]"),
        expect.anything()
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns null and logs a warning when getSize fails", async () => {
    mockGetSize.mockImplementation(
      (_uri: string, _success: unknown, failure: (err: Error) => void) =>
        failure(new Error("getSize error"))
    );
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await compressForStorage(TEST_URI);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[compressForStorage]"),
        expect.anything()
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
