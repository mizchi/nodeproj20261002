import { expect, test } from "vite-plus/test";
import { runRingModel } from "./support/ring-model.ts";
import type { Operation } from "./support/ring-model.ts";

const alphabet: readonly Operation[] = [
  { kind: "write", bytes: [] },
  { kind: "write", bytes: [0] },
  { kind: "write", bytes: [1] },
  { kind: "read", count: 0 },
  { kind: "read", count: 1 },
  { kind: "clear" },
];

function* sequences(prefix: readonly Operation[] = []): Generator<readonly Operation[]> {
  yield prefix;
  if (prefix.length === 4) return;
  for (const operation of alphabet) yield* sequences([...prefix, operation]);
}

test("容量 1〜3、6 種類の操作、長さ 0〜4 の全 4,665 ケースで参照モデルと一致する", () => {
  let checked = 0;
  for (let capacity = 1; capacity <= 3; capacity++) {
    for (const operations of sequences()) {
      runRingModel(capacity, operations);
      checked++;
    }
  }
  expect(checked).toBe(4_665);
});
