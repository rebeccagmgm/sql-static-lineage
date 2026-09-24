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


it("folds both task segments when either original field is offscreen", () => {
  const raw = {kind:"VALUE",from:"read",to:"write"};
  const input = {sourceHandle:"read",targetHandle:"mapping:input",data:{raw}};
  const output = {sourceHandle:"mapping:output",targetHandle:"write",data:{raw}};
  for (const hidden of [new Set(["read"]), new Set(["write"])]) {
    expect(edgeTouchesHiddenField(input, hidden)).toBe(true);
    expect(edgeTouchesHiddenField(output, hidden)).toBe(true);
  }
  expect(edgeTouchesHiddenField(output, new Set())).toBe(false);
});
