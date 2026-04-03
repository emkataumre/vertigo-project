import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import ConfirmationScreen from "../components/ConfirmationScreen";

const defaultProps = {
  photoUri: "file://photo.jpg",
  itemName: "Coffee filter",
  onConfirm: jest.fn(),
  onDeny: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("ConfirmationScreen", () => {
  it("renders item name as a question", () => {
    render(<ConfirmationScreen {...defaultProps} />);
    expect(screen.getByText("Coffee filter?")).toBeTruthy();
  });

  it("renders photo preview with correct uri", () => {
    render(<ConfirmationScreen {...defaultProps} />);
    const image = screen.getByTestId("photo-preview");
    expect(image.props.source).toEqual({ uri: "file://photo.jpg" });
  });

  it("calls onConfirm when Yes is pressed", () => {
    render(<ConfirmationScreen {...defaultProps} />);
    fireEvent.press(screen.getByText("Yes"));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onDeny when No is pressed", () => {
    render(<ConfirmationScreen {...defaultProps} />);
    fireEvent.press(screen.getByText("No"));
    expect(defaultProps.onDeny).toHaveBeenCalledTimes(1);
  });
});
