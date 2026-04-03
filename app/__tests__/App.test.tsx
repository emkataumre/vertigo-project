import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { useCameraPermissions } from "expo-camera";
import App from "../App";
import { callIdentify } from "../lib/callIdentify";
import { saveScan } from "../lib/saveScan";
import { saveCorrection } from "../lib/saveCorrection";

jest.mock("../lib/callIdentify");
jest.mock("../lib/saveScan");
jest.mock("../lib/saveCorrection");

const mockCallIdentify = callIdentify as jest.Mock;
const mockSaveScan = saveScan as jest.Mock;
const mockSaveCorrection = saveCorrection as jest.Mock;
const mockUseCameraPermissions = useCameraPermissions as jest.Mock;

// Camera ref mock — returned by useRef, used to call takePictureAsync
const mockTakePictureAsync = jest.fn();
jest.mock("expo-camera", () => {
  // require is allowed inside jest.mock factory; React variable is not (hoisting restriction)
  const mockReact = require("react");
  return {
    CameraView: mockReact.forwardRef((_props: object, ref: unknown) => {
      mockReact.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePictureAsync }));
      return null;
    }),
    useCameraPermissions: jest.fn(() => [
      { granted: true },
      jest.fn().mockResolvedValue({ granted: true }),
    ]),
  };
});

const validResponse = {
  item: "Coffee filter",
  bin_id: "madaffald",
  reason_en: "Used coffee filters are organic waste.",
  reason_da: "Brugte kaffefiltre hører til i madaffald.",
  alternatives: [
    { item: "Coffee bag (plastic)", bin_id: "restaffald" },
  ],
};

const validPhoto = { uri: "file://photo.jpg", base64: "validbase64string" };

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveScan.mockResolvedValue(undefined);
  mockSaveCorrection.mockResolvedValue(undefined);
  mockTakePictureAsync.mockResolvedValue(validPhoto);
  mockUseCameraPermissions.mockReturnValue([
    { granted: true },
    jest.fn().mockResolvedValue({ granted: true }),
  ]);
});

describe("App", () => {
  it("renders capture button when permission is granted", () => {
    render(<App />);
    expect(screen.queryByText("Something went wrong")).toBeNull();
    expect(screen.queryByText("Identifying")).toBeNull();
  });

  it("shows permission denied screen when camera access is not granted", () => {
    mockUseCameraPermissions.mockReturnValue([
      { granted: false },
      jest.fn().mockResolvedValue({ granted: false }),
    ]);
    render(<App />);
    expect(screen.getByText("Camera access is required to use Vertigo.")).toBeTruthy();
    expect(screen.getByText("Open Settings")).toBeTruthy();
  });

  it("happy path: capture → confirmation → result → camera", async () => {
    mockCallIdentify.mockResolvedValue(validResponse);
    render(<App />);

    const captureButton = screen.getByTestId("capture-button");
    await act(async () => {
      fireEvent.press(captureButton);
    });

    // Confirmation screen appears — saveScan NOT called yet
    await waitFor(() => {
      expect(screen.getByText("Coffee filter?")).toBeTruthy();
    });
    expect(mockSaveScan).not.toHaveBeenCalled();

    // Confirm → saveScan called, result screen shown
    await act(async () => {
      fireEvent.press(screen.getByText("Yes"));
    });
    expect(mockSaveScan).toHaveBeenCalledTimes(1);
    expect(mockSaveScan).toHaveBeenCalledWith(
      validPhoto.uri,
      validPhoto.base64,
      expect.objectContaining({
        item: "Coffee filter",
        bin_id: "madaffald",
        reason_en: "Used coffee filters are organic waste.",
      })
    );

    expect(screen.getByText("Food Waste")).toBeTruthy();
    expect(screen.getByText("Coffee filter")).toBeTruthy();
    expect(screen.getByText("Used coffee filters are organic waste.")).toBeTruthy();

    // Scan again → back to camera
    await act(async () => {
      fireEvent.press(screen.getByText("Scan Again"));
    });
    expect(screen.queryByText("Food Waste")).toBeNull();
  });

  it("unidentifiable path: bin_id null → unidentifiable overlay → try again", async () => {
    mockCallIdentify.mockResolvedValue({ ...validResponse, bin_id: null });
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });

    await waitFor(() => {
      expect(screen.getByText("Couldn't identify this item")).toBeTruthy();
    });

    expect(mockSaveScan).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByText("Try Again"));
    });
    expect(screen.queryByText("Couldn't identify this item")).toBeNull();
  });

  it("error path: callIdentify throws → error overlay → try again", async () => {
    mockCallIdentify.mockRejectedValue(new Error("Network error"));
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeTruthy();
    });

    expect(mockSaveScan).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByText("Try Again"));
    });
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("deny path: confirmation → correction screen with alternatives", async () => {
    mockCallIdentify.mockResolvedValue(validResponse);
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });

    await waitFor(() => {
      expect(screen.getByText("Yes")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("No"));
    });

    expect(screen.getByText("What is it?")).toBeTruthy();
    expect(screen.getByText("Coffee bag (plastic)")).toBeTruthy();
  });

  it("selecting an alternative saves correction and shows result", async () => {
    mockCallIdentify.mockResolvedValue(validResponse);
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });
    await waitFor(() => expect(screen.getByText("No")).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByText("No")); });
    await act(async () => {
      fireEvent.press(screen.getByText("Coffee bag (plastic)"));
    });

    // saveCorrection called with predicted + corrected data
    expect(mockSaveCorrection).toHaveBeenCalledWith(
      validPhoto.uri,
      validPhoto.base64,
      "Coffee filter",
      "madaffald",
      "Coffee bag (plastic)",
      "restaffald"
    );

    // Shows result screen with corrected item's bin
    expect(screen.getByText("Residual Waste")).toBeTruthy();
    expect(screen.getByText("Coffee bag (plastic)")).toBeTruthy();

    // saveScan was NOT called (only corrections saved)
    expect(mockSaveScan).not.toHaveBeenCalled();
  });

  it("empty base64 guard: does not call callIdentify, shows error", async () => {
    mockTakePictureAsync.mockResolvedValue({ uri: "file://photo.jpg", base64: undefined });
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeTruthy();
    });
    expect(mockCallIdentify).not.toHaveBeenCalled();
  });

  it("null photo guard: does not call callIdentify, shows error", async () => {
    mockTakePictureAsync.mockResolvedValue(null);
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeTruthy();
    });
    expect(mockCallIdentify).not.toHaveBeenCalled();
  });
});
