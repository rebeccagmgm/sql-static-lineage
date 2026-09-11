import { describe, it, expect } from "vitest";
import { fieldHandleVisible, edgeTouchesHiddenField } from "./field-viewport";
describe("field viewport", () => {
  it("keeps an endpoint only when its row center is visible", () => {
    expect(fieldHandleVisible(10, 50, 0, 80)).toBe(true);
    expect(fieldHandleVisible(70, 110, 0, 80)).toBe(false);
    expect(fieldHandleVisible(-50, -10, 0, 80)).toBe(false);
    expect(fieldHandleVisible(-10, 30, 0, 80)).toBe(true);
  });
  it("folds edges whose source or target endpoint is outside its card", () => {
    const hidden = new Set(["offscreen"]);
    expect(
      edgeTouchesHiddenField(
        { sourceHandle: "offscreen", targetHandle: "visible" },
        hidden,
      ),
    ).toBe(true);
    expect(
      edgeTouchesHiddenField(
        { sourceHandle: "visible", targetHandle: "offscreen" },
        hidden,
      ),
    ).toBe(true);
    expect(
      edgeTouchesHiddenField(
        { sourceHandle: "visible", targetHandle: "other" },
        hidden,
      ),
    ).toBe(false);
    expect(edgeTouchesHiddenField({}, hidden)).toBe(false);
  });
});
