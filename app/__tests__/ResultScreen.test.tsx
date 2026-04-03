import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import ResultScreen from "../components/ResultScreen";
import { BINS_BY_ID } from "../constants/bins";
import type { BinId } from "../constants/bins";

const defaultProps = {
  item: "Coffee filter",
  binId: "madaffald" as BinId,
  reason: "Used coffee filters are organic waste.",
  onDone: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("ResultScreen", () => {
  it("renders bin name, item, and reason", () => {
    render(<ResultScreen {...defaultProps} />);
    expect(screen.getByText(BINS_BY_ID["madaffald"].nameEn)).toBeTruthy();
    expect(screen.getByText("Coffee filter")).toBeTruthy();
    expect(screen.getByText("Used coffee filters are organic waste.")).toBeTruthy();
  });

  it("applies the correct bin color to the badge", () => {
    render(<ResultScreen {...defaultProps} />);
    const badge = screen.getByTestId("bin-badge");
    expect(badge.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: BINS_BY_ID["madaffald"].color }),
      ])
    );
  });

  it("calls onDone when Scan Again is pressed", () => {
    render(<ResultScreen {...defaultProps} />);
    fireEvent.press(screen.getByText("Scan Again"));
    expect(defaultProps.onDone).toHaveBeenCalledTimes(1);
  });

  it("does not crash when given an unknown binId", () => {
    render(
      <ResultScreen
        {...defaultProps}
        binId={"unknown-bin" as BinId}
      />
    );
    // Falls back to displaying the raw binId and default color
    expect(screen.getByText("unknown-bin")).toBeTruthy();
  });
});
