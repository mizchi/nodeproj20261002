import { expect, test } from "vite-plus/test";
import * as ring from "../src/ring-buffer.ts";

test("縮小された反例: 容量 1 の満杯バッファを 0 バイト読んでもデータを失わない", () => {
  const state = ring.create(1);
  ring.completeWrite(state, ring.write(state, Uint8Array.of(0)));
  ring.completeRead(state, ring.read(state, new Uint8Array(0)));

  expect(ring.length(state)).toBe(1);
  expect(ring.isFull(state)).toBe(true);
  const [head, tail] = ring.readable(state);
  expect([...head, ...tail]).toEqual([0]);
});
