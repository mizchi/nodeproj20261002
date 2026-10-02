import { expect, test } from "vitest";

import { commitRead, commitWrite, cursorLength } from "../src/ring-cursor.ts";

test("満杯での 0 件の read は内容を保持する", () => {
  const full = { front: 0, back: 0, full: true };
  expect(commitRead(1, full, 0)).toEqual(full);
  expect(cursorLength(1, commitRead(1, full, 0))).toBe(1);
});

test("空での 0 件の write は空のまま", () => {
  const empty = { front: 0, back: 0, full: false };
  expect(commitWrite(1, empty, 0)).toEqual(empty);
});

test("折り返す write と read でも長さが増減する", () => {
  const before = { front: 2, back: 3, full: false };
  const written = commitWrite(4, before, 3);
  expect(written).toEqual({ front: 2, back: 2, full: true });
  expect(cursorLength(4, written)).toBe(4);
  const read = commitRead(4, written, 3);
  expect(read).toEqual({ front: 1, back: 2, full: false });
  expect(cursorLength(4, read)).toBe(1);
});
