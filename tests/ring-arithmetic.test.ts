import { expect, test } from "vitest";
import { advanceIndex, fullAfterRead, fullAfterWrite } from "../src/ring-cursor.ts";

test("容量ちょうど進めると、安全な整数の上限でも元の位置に戻る", () => {
  const capacity = Number.MAX_SAFE_INTEGER;
  expect(advanceIndex(capacity, capacity - 1, capacity)).toBe(capacity - 1);
});

test("末尾ちょうどに進めると先頭に折り返す", () => {
  expect(advanceIndex(4, 3, 1)).toBe(0);
});

test("0 件では空・満杯の両方を保持する", () => {
  for (const full of [false, true]) {
    expect(fullAfterRead(full, 0)).toBe(full);
    expect(fullAfterWrite(0, 0, full, 0)).toBe(full);
  }
});
