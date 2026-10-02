import { describe, expect, test } from "vite-plus/test";
import * as ring from "../src/ring-buffer.ts";

describe("ring buffer の通常ケースと入力契約", () => {
  test("折り返さない書き込みと読み込み", () => {
    const state = ring.create(4);
    expect(ring.capacity(state)).toBe(4);
    expect(ring.length(state)).toBe(0);
    expect(ring.isEmpty(state)).toBe(true);
    expect(ring.isFull(state)).toBe(false);
    expect(ring.available(state)).toBe(4);

    const written = ring.write(state, Uint8Array.of(10, 20));
    expect(written).toBe(2);
    ring.completeWrite(state, written);
    expect(ring.length(state)).toBe(2);
    expect(ring.readable(state)).toEqual([Uint8Array.of(10, 20), new Uint8Array()]);

    const output = new Uint8Array(1);
    const read = ring.read(state, output);
    expect(read).toBe(1);
    expect(output).toEqual(Uint8Array.of(10));
    ring.completeRead(state, read);
    expect(ring.length(state)).toBe(1);
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "容量 %s は拒否する",
    (capacity) => {
      expect(() => ring.create(capacity)).toThrow(RangeError);
    },
  );

  test.each([-1, 1.5, Number.NaN, 5])("書き込み確定数 %s は拒否する", (count) => {
    expect(() => ring.completeWrite(ring.create(4), count)).toThrow(RangeError);
  });

  test.each([-1, 1.5, Number.NaN, 1])("読み込み確定数 %s は拒否する", (count) => {
    expect(() => ring.completeRead(ring.create(4), count)).toThrow(RangeError);
  });
});
