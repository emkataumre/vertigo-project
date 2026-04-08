import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { useCameraPermissions } from "expo-camera";
import App from "../App";
import { callIdentify } from "../lib/callIdentify";
import { callClassifyText } from "../lib/callClassifyText";
import { saveScan } from "../lib/saveScan";
import { saveCorrection } from "../lib/saveCorrection";
import { compressForIdentify, compressForStorage } from "../lib/compressImage";

jest.mock("../lib/callIdentify");
jest.mock("../lib/callClassifyText");
jest.mock("../lib/saveScan");
jest.mock("../lib/saveCorrection");
jest.mock("../lib/compressImage", () => ({
  compressForIdentify: jest.fn().mockResolvedValue(null),
  compressForStorage: jest.fn().mockResolvedValue(null),
}));

const mockLightSensorRemove = jest.fn();
jest.mock("expo-sensors", () => ({
  LightSensor: {
    addListener: jest.fn(() => ({ remove: mockLightSensorRemove })),
  },
}));

jest.mock("@expo/vector-icons", () => {
  const mockReact = require("react");
  return {
    Ionicons: ({ name }: { name: string }) =>
      mockReact.createElement("View", { testID: `icon-${name}` }),
  };
});

const mockCallIdentify = callIdentify as jest.Mock;
const mockCallClassifyText = callClassifyText as jest.Mock;
const mockSaveScan = saveScan as jest.Mock;
const mockSaveCorrection = saveCorrection as jest.Mock;
const mockCompressForIdentify = compressForIdentify as jest.Mock;
const mockCompressForStorage = compressForStorage as jest.Mock;
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
  mockLightSensorRemove.mockReset();
  mockSaveScan.mockResolvedValue(undefined);
  mockSaveCorrection.mockResolvedValue(undefined);
  mockCallClassifyText.mockResolvedValue(null);
  mockCompressForIdentify.mockResolvedValue(null);
  mockCompressForStorage.mockResolvedValue(null);
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
    mockCallIdentify.mockRejectedValue(new Error("Something failed"));
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

  it("network error path: Supabase fetch error → shows 'No internet connection'", async () => {
    // Supabase wraps the underlying TypeError into its own error class —
    // simulate that with a plain Error matching the Supabase message.
    mockCallIdentify.mockRejectedValue(new Error("Failed to send a request to the Edge Function"));
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });

    await waitFor(() => {
      expect(screen.getByText("No internet connection")).toBeTruthy();
    });
    expect(mockSaveScan).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByText("Try Again"));
    });
    expect(screen.queryByText("No internet connection")).toBeNull();
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

    // saveCorrection called with predicted + corrected data (fire-and-forget — use waitFor)
    await waitFor(() => {
      expect(mockSaveCorrection).toHaveBeenCalledWith(
        validPhoto.uri,
        validPhoto.base64,
        "Coffee filter",
        "madaffald",
        "Coffee bag (plastic)",
        "restaffald"
      );
    });

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

  it("compressed base64 is sent to callIdentify when compression succeeds", async () => {
    mockCompressForIdentify.mockResolvedValue("compressed_identify_data");
    mockCallIdentify.mockResolvedValue(validResponse);
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });

    await waitFor(() => expect(screen.getByText("Coffee filter?")).toBeTruthy());
    expect(mockCallIdentify).toHaveBeenCalledWith("compressed_identify_data");
  });

  it("compressed base64 is passed to saveScan when storage compression succeeds", async () => {
    mockCompressForStorage.mockResolvedValue("compressed_storage_data");
    mockCallIdentify.mockResolvedValue(validResponse);
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });
    await waitFor(() => expect(screen.getByText("Yes")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Yes"));
    });

    expect(mockSaveScan).toHaveBeenCalledWith(
      validPhoto.uri,
      "compressed_storage_data",
      expect.objectContaining({ item: "Coffee filter" })
    );
  });

  it("compressed base64 is passed to saveCorrection when storage compression succeeds", async () => {
    mockCompressForStorage.mockResolvedValue("compressed_storage_data");
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

    await waitFor(() => {
      expect(mockSaveCorrection).toHaveBeenCalledWith(
        validPhoto.uri,
        "compressed_storage_data",
        "Coffee filter",
        "madaffald",
        "Coffee bag (plastic)",
        "restaffald"
      );
    });
  });

  it("free-text correction: classify-text success → saves correction with bin and shows result with reason", async () => {
    mockCallIdentify.mockResolvedValue(validResponse);
    mockCallClassifyText.mockResolvedValue({
      bin_id: "madaffald",
      reason_en: "Banana peels are organic waste.",
      reason_da: "Bananskræller er organisk affald.",
    });
    render(<App />);

    await act(async () => { fireEvent.press(screen.getByTestId("capture-button")); });
    await waitFor(() => expect(screen.getByText("No")).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByText("No")); });

    fireEvent.changeText(screen.getByPlaceholderText("Type the item name"), "Banana peel");
    await act(async () => { fireEvent.press(screen.getByTestId("send-button")); });

    await waitFor(() => {
      expect(screen.getByText("Food Waste")).toBeTruthy();
    });
    expect(screen.getByText("Banana peels are organic waste.")).toBeTruthy();

    expect(mockCallClassifyText).toHaveBeenCalledWith("Banana peel");
    await waitFor(() => {
      expect(mockSaveCorrection).toHaveBeenCalledWith(
        validPhoto.uri,
        validPhoto.base64,
        "Coffee filter",
        "madaffald",
        "Banana peel",
        "madaffald"
      );
    });
    expect(mockSaveScan).not.toHaveBeenCalled();
  });

  it("free-text correction: classify-text failure → saves correction with null bin and resets to camera", async () => {
    mockCallIdentify.mockResolvedValue(validResponse);
    mockCallClassifyText.mockRejectedValue(new Error("network error"));
    render(<App />);

    await act(async () => { fireEvent.press(screen.getByTestId("capture-button")); });
    await waitFor(() => expect(screen.getByText("No")).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByText("No")); });

    fireEvent.changeText(screen.getByPlaceholderText("Type the item name"), "mystery item");
    await act(async () => { fireEvent.press(screen.getByTestId("send-button")); });

    await waitFor(() => {
      expect(screen.queryByText("What is it?")).toBeNull();
    });

    await waitFor(() => {
      expect(mockSaveCorrection).toHaveBeenCalledWith(
        validPhoto.uri,
        validPhoto.base64,
        "Coffee filter",
        "madaffald",
        "mystery item",
        null
      );
    });
    expect(screen.queryByText("Food Waste")).toBeNull();
  });

  it("torch button is visible on camera screen with flash-off icon", () => {
    render(<App />);
    expect(screen.getByTestId("torch-button")).toBeTruthy();
    expect(screen.getByTestId("icon-flash-off")).toBeTruthy();
  });

  it("torch button toggles flash icon on each press", async () => {
    render(<App />);
    expect(screen.getByTestId("icon-flash-off")).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByTestId("torch-button")); });
    expect(screen.getByTestId("icon-flash")).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByTestId("torch-button")); });
    expect(screen.getByTestId("icon-flash-off")).toBeTruthy();
  });

  it("torch resets to off when returning to camera after error", async () => {
    mockCallIdentify.mockRejectedValue(new Error("fail"));
    render(<App />);

    // Enable torch first so reset is meaningful
    await act(async () => { fireEvent.press(screen.getByTestId("torch-button")); });
    expect(screen.getByTestId("icon-flash")).toBeTruthy();

    // Trigger capture → error (torch button hides during scan)
    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });
    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeTruthy());

    // Return to camera — torch must be reset off
    await act(async () => {
      fireEvent.press(screen.getByText("Try Again"));
    });
    expect(screen.getByTestId("icon-flash-off")).toBeTruthy();
  });

  it("torch button is not visible when not in camera state", async () => {
    mockCallIdentify.mockRejectedValue(new Error("fail"));
    render(<App />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("capture-button"));
    });
    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeTruthy());

    expect(screen.queryByTestId("torch-button")).toBeNull();
  });

  it("LightSensor is not subscribed on non-Android platforms (iOS guard)", () => {
    // Jest runs with Platform.OS = 'ios' by default.
    // The LightSensor subscription is Android-only — verify the guard prevents subscription.
    const { LightSensor } = require("expo-sensors");
    render(<App />);
    expect(LightSensor.addListener).not.toHaveBeenCalled();
  });

  it("result screen is shown immediately — UI does not wait for saveCorrection to complete", async () => {
    // saveCorrection is fire-and-forget: the result screen must appear before the save resolves.
    // In production saveCorrection never rejects (catches internally), so we test the timing contract.
    let resolveSave!: () => void;
    mockCallIdentify.mockResolvedValue(validResponse);
    mockSaveCorrection.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve; }));
    render(<App />);

    await act(async () => { fireEvent.press(screen.getByTestId("capture-button")); });
    await waitFor(() => expect(screen.getByText("No")).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByText("No")); });
    await act(async () => { fireEvent.press(screen.getByText("Coffee bag (plastic)")); });

    // Result screen shown before save completes
    await waitFor(() => expect(screen.getByText("Residual Waste")).toBeTruthy());

    // Now let the save complete — no crash
    await act(async () => { resolveSave(); });
    expect(screen.getByText("Residual Waste")).toBeTruthy();
  });
});
