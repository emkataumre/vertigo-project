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
  // Default: landscape image above target size → resize by width
  mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
    success(1920, 1080)
  );
});

describe("compressForIdentify", () => {
  it("resizes landscape images above 800px by width", async () => {
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

  it("resizes portrait images above 800px by height", async () => {
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

  it("resizes square images by width (width >= height boundary)", async () => {
    mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(1200, 1200)
    );
    mockManipulateAsync.mockResolvedValue({ base64: COMPRESSED_BASE64, uri: "file:///tmp/out.jpg" });

    await compressForIdentify(TEST_URI);

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      TEST_URI,
      [{ resize: { width: 800 } }],
      { compress: 0.6, format: "jpeg", base64: true }
    );
  });

  it("skips resize when image is already at or below 800px", async () => {
    mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(600, 400)
    );
    mockManipulateAsync.mockResolvedValue({ base64: COMPRESSED_BASE64, uri: "file:///tmp/out.jpg" });

    await compressForIdentify(TEST_URI);

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      TEST_URI,
      [],
      { compress: 0.6, format: "jpeg", base64: true }
    );
  });

  it("returns null when manipulator returns no base64", async () => {
    mockManipulateAsync.mockResolvedValue({ uri: "file:///tmp/out.jpg" });

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await compressForIdentify(TEST_URI);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();

    expect(result).toBeNull();
  });

  it("returns null when manipulator returns empty string base64", async () => {
    // "" is falsy, so `|| null` treats it as a failure and falls back to null.
    mockManipulateAsync.mockResolvedValue({ base64: "", uri: "file:///tmp/out.jpg" });

    const result = await compressForIdentify(TEST_URI);

    expect(result).toBeNull();
  });

  it("returns null and logs an error when manipulator throws", async () => {
    mockManipulateAsync.mockRejectedValue(new Error("manipulator error"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await compressForIdentify(TEST_URI);
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[compressForIdentify]"),
        expect.anything()
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("returns null and logs an error when getSize fails", async () => {
    mockGetSize.mockImplementation(
      (_uri: string, _success: unknown, failure: (err: Error) => void) =>
        failure(new Error("getSize error"))
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await compressForIdentify(TEST_URI);
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[compressForIdentify]"),
        expect.anything()
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("compressForStorage", () => {
  it("resizes landscape images above 2048px by width", async () => {
    mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(4032, 3024)
    );
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

  it("resizes portrait images above 2048px by height", async () => {
    mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(3024, 4032)
    );
    mockManipulateAsync.mockResolvedValue({ base64: COMPRESSED_BASE64, uri: "file:///tmp/out.jpg" });

    await compressForStorage(TEST_URI);

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      TEST_URI,
      [{ resize: { height: 2048 } }],
      { compress: 0.85, format: "jpeg", base64: true }
    );
  });

  it("resizes square images by width (width >= height boundary)", async () => {
    mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(3000, 3000)
    );
    mockManipulateAsync.mockResolvedValue({ base64: COMPRESSED_BASE64, uri: "file:///tmp/out.jpg" });

    await compressForStorage(TEST_URI);

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      TEST_URI,
      [{ resize: { width: 2048 } }],
      { compress: 0.85, format: "jpeg", base64: true }
    );
  });

  it("skips resize when image is already at or below 2048px", async () => {
    mockGetSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(1920, 1080)
    );
    mockManipulateAsync.mockResolvedValue({ base64: COMPRESSED_BASE64, uri: "file:///tmp/out.jpg" });

    await compressForStorage(TEST_URI);

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      TEST_URI,
      [],
      { compress: 0.85, format: "jpeg", base64: true }
    );
  });

  it("returns null when manipulator returns no base64", async () => {
    mockManipulateAsync.mockResolvedValue({ uri: "file:///tmp/out.jpg" });

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await compressForStorage(TEST_URI);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();

    expect(result).toBeNull();
  });

  it("returns null when manipulator returns empty string base64", async () => {
    // "" is falsy, so `|| null` treats it as a failure and falls back to null.
    mockManipulateAsync.mockResolvedValue({ base64: "", uri: "file:///tmp/out.jpg" });

    const result = await compressForStorage(TEST_URI);

    expect(result).toBeNull();
  });

  it("returns null and logs an error when manipulator throws", async () => {
    mockManipulateAsync.mockRejectedValue(new Error("manipulator error"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await compressForStorage(TEST_URI);
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[compressForStorage]"),
        expect.anything()
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("returns null and logs an error when getSize fails", async () => {
    mockGetSize.mockImplementation(
      (_uri: string, _success: unknown, failure: (err: Error) => void) =>
        failure(new Error("getSize error"))
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await compressForStorage(TEST_URI);
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[compressForStorage]"),
        expect.anything()
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
