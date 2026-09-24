import {expect, it, vi} from "vitest";
import {cancellableRead} from "../src/asset-graph/cancellable-read.ts";

it("does not start another database stage after disconnect", async () => {
  const controller = new AbortController();
  const next = vi.fn();
  const flow = async () => {
    await cancellableRead(controller.signal, async () => { controller.abort(); return 1; });
    next();
  };
  await expect(flow()).rejects.toMatchObject({name: "AbortError"});
  expect(next).not.toHaveBeenCalled();
  await expect(cancellableRead(controller.signal, next)).rejects.toMatchObject({name: "AbortError"});
  expect(next).not.toHaveBeenCalled();
});
