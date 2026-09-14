import { expect, it } from "vitest";
import { withVisibility } from "./stable-copy";
it("reuses unchanged normalized flags while keeping source immutable", () => {
  const source = {id:"a"};
  const visible = withVisibility(source, {hidden:false, selected:false});
  expect(visible).toEqual({id:"a",hidden:false,selected:false});
  expect(withVisibility(source, {hidden:false, selected:false})).toBe(visible);
  expect(withVisibility(visible, {hidden:false, selected:false})).toBe(visible);
  expect(withVisibility(source, {hidden:true, selected:false})).not.toBe(visible);
  expect(source).toEqual({id:"a"});
});
