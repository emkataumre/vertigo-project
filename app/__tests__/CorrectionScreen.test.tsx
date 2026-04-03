import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import CorrectionScreen from "../components/CorrectionScreen";
import type { Alternative } from "../components/CorrectionScreen";
import type { BinId } from "../constants/bins";

const alternatives: Alternative[] = [
  { item: "Coffee bag (plastic)", bin: "restaffald" as BinId },
  { item: "Coffee capsule (aluminium)", bin: "metal" as BinId },
];

function makeProps() {
  return {
    alternatives,
    onSelect: jest.fn(),
    onClassify: jest.fn().mockResolvedValue(null),
    onCancel: jest.fn(),
  };
}

describe("CorrectionScreen", () => {
  it("renders all alternative buttons", () => {
    render(<CorrectionScreen {...makeProps()} />);
    expect(screen.getByText("Coffee bag (plastic)")).toBeTruthy();
    expect(screen.getByText("Coffee capsule (aluminium)")).toBeTruthy();
  });

  it("calls onSelect with item and bin when an alternative is pressed", () => {
    const props = makeProps();
    render(<CorrectionScreen {...props} />);
    fireEvent.press(screen.getByText("Coffee bag (plastic)"));
    expect(props.onSelect).toHaveBeenCalledWith("Coffee bag (plastic)", "restaffald");
  });

  it("calls onClassify with trimmed text when Send is pressed", async () => {
    const props = makeProps();
    render(<CorrectionScreen {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type the item name"), "Banana peel");
    await act(async () => {
      fireEvent.press(screen.getByTestId("send-button"));
    });
    expect(props.onClassify).toHaveBeenCalledWith("Banana peel");
  });

  it("calls onSelect with null bin when onClassify returns null", async () => {
    const props = makeProps();
    props.onClassify.mockResolvedValue(null);
    render(<CorrectionScreen {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type the item name"), "Banana peel");
    await act(async () => {
      fireEvent.press(screen.getByTestId("send-button"));
    });
    expect(props.onSelect).toHaveBeenCalledWith("Banana peel", null);
  });

  it("calls onSelect with bin_id, reason_en and reason_da when onClassify succeeds", async () => {
    const props = makeProps();
    props.onClassify.mockResolvedValue({
      bin_id: "madaffald",
      reason_en: "Banana peels are organic waste.",
      reason_da: "Bananskræller er organisk affald.",
    });
    render(<CorrectionScreen {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type the item name"), "Banana peel");
    await act(async () => {
      fireEvent.press(screen.getByTestId("send-button"));
    });
    expect(props.onSelect).toHaveBeenCalledWith(
      "Banana peel",
      "madaffald",
      "Banana peels are organic waste.",
      "Bananskræller er organisk affald."
    );
  });

  it("calls onSelect with null bin when onClassify returns bin_id null", async () => {
    const props = makeProps();
    props.onClassify.mockResolvedValue({ bin_id: null, reason_en: "", reason_da: "" });
    render(<CorrectionScreen {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type the item name"), "asdfgh");
    await act(async () => {
      fireEvent.press(screen.getByTestId("send-button"));
    });
    expect(props.onSelect).toHaveBeenCalledWith("asdfgh", null);
  });

  it("resets classifying state after onClassify resolves, re-enabling Send", async () => {
    // In production, handleClassify in App.tsx always catches errors and returns null,
    // so onClassify never throws. This test verifies classifying resets after the call completes.
    const props = makeProps();
    props.onClassify.mockResolvedValue(null);
    render(<CorrectionScreen {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type the item name"), "coffee filter");
    await act(async () => {
      fireEvent.press(screen.getByTestId("send-button"));
    });
    // After completion, Send button should be re-enabled (not stuck in "..." state)
    expect(screen.getByText("Send")).toBeTruthy();
  });

  it("Send button shows '...' while classifying", async () => {
    const props = makeProps();
    let resolveClassify!: () => void;
    props.onClassify.mockReturnValue(
      new Promise<null>((resolve) => {
        resolveClassify = () => resolve(null);
      })
    );
    render(<CorrectionScreen {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type the item name"), "Banana peel");

    act(() => {
      fireEvent.press(screen.getByTestId("send-button"));
    });

    expect(screen.getByText("...")).toBeTruthy();

    await act(async () => { resolveClassify(); });
  });

  it("Send button is disabled when text input is empty", () => {
    const props = makeProps();
    render(<CorrectionScreen {...props} />);
    fireEvent.press(screen.getByTestId("send-button"));
    expect(props.onClassify).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is pressed", () => {
    const props = makeProps();
    render(<CorrectionScreen {...props} />);
    fireEvent.press(screen.getByText("Cancel"));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});
