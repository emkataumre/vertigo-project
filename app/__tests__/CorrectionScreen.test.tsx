import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import CorrectionScreen from "../components/CorrectionScreen";
import type { Alternative } from "../components/CorrectionScreen";
import type { BinId } from "../constants/bins";

const alternatives: Alternative[] = [
  { item: "Coffee bag (plastic)", bin: "restaffald" as BinId },
  { item: "Coffee capsule (aluminium)", bin: "metal" as BinId },
];

const defaultProps = {
  alternatives,
  onSelect: jest.fn(),
  onCancel: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("CorrectionScreen", () => {
  it("renders all alternative buttons", () => {
    render(<CorrectionScreen {...defaultProps} />);
    expect(screen.getByText("Coffee bag (plastic)")).toBeTruthy();
    expect(screen.getByText("Coffee capsule (aluminium)")).toBeTruthy();
  });

  it("calls onSelect with item and bin when an alternative is pressed", () => {
    render(<CorrectionScreen {...defaultProps} />);
    fireEvent.press(screen.getByText("Coffee bag (plastic)"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith("Coffee bag (plastic)", "restaffald");
  });

  it("calls onSelect with trimmed text and null bin when Send is pressed", () => {
    render(<CorrectionScreen {...defaultProps} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type the item name"), "Banana peel");
    fireEvent.press(screen.getByText("Send"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith("Banana peel", null);
  });

  it("Send button is disabled when text input is empty", () => {
    render(<CorrectionScreen {...defaultProps} />);
    const sendButton = screen.getByText("Send");
    // Pressable is disabled — pressing it should not call onSelect
    fireEvent.press(sendButton);
    expect(defaultProps.onSelect).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is pressed", () => {
    render(<CorrectionScreen {...defaultProps} />);
    fireEvent.press(screen.getByText("Cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
