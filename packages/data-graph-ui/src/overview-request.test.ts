import { expect, it, vi } from "vitest";
import { createOverviewRequest } from "./overview-request";

it("cancels transport only when the last reader leaves", async () => {
  let transport!: AbortSignal;
  const read = vi.fn((_h: string[], _c: string[], signal: AbortSignal) => {
    transport = signal;
    return new Promise<string>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  });
  const request = createOverviewRequest(read);
  const a = new AbortController(), b = new AbortController();
  const first = request([], [], a.signal).catch(e => e.name);
  const second = request([], [], b.signal).catch(e => e.name);
  await Promise.resolve();
  a.abort();
  expect(await first).toBe("AbortError");
  expect(transport.aborted).toBe(false);
  b.abort();
  expect(await second).toBe("AbortError");
  expect(transport.aborted).toBe(true);
});

it("retries immediately after cancellation without reusing an aborted read", async () => {
  const read = vi.fn(async (_h: string[], _c: string[], signal: AbortSignal) => {
    signal.throwIfAborted();
    return "ok";
  });
  const request = createOverviewRequest(read);
  const controller = new AbortController();
  const first = request([], [], controller.signal).catch(e => e.name);
  controller.abort();
  expect(await request([], [])).toBe("ok");
  expect(await first).toBe("AbortError");
});

it("shares concurrent identical reads but re-reads after completion and for other filters", async () => {
  const read = vi.fn(async () => ({ version: "v1" }));
  const request = createOverviewRequest(read);
  const first = request([], ["A"]);
  expect(request([], ["A"])).toBe(first);
  await Promise.all([first, request([], ["B"])]);
  expect(read).toHaveBeenCalledTimes(2);
  await request([], ["A"]);
  expect(read).toHaveBeenCalledTimes(3);
});

it("allows retry after a failed request", async () => {
  const read = vi.fn().mockRejectedValueOnce(new Error("failed")).mockResolvedValue("ok");
  const request = createOverviewRequest(read);
  await expect(request([], [])).rejects.toThrow("failed");
  await expect(request([], [])).resolves.toBe("ok");
});
