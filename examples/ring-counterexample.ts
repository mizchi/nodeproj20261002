import assert from "node:assert/strict";
import fc from "fast-check";
import * as ring from "../src/ring-buffer.ts";
import {
  capacityArbitrary,
  operationSequences,
  propertyParameters,
} from "../tests/support/ring-arbitraries.ts";
import { runRingModel, runSelfConsistency } from "../tests/support/ring-model.ts";
import type { RingApi } from "../tests/support/ring-model.ts";

// completeRead の「count > 0」ガードを落とした既知の mutant を注入する。
const broken: RingApi = {
  ...ring,
  completeRead(state, count) {
    ring.completeRead(state, count);
    state.full = false;
  },
};

const inputs = [capacityArbitrary, operationSequences()] as const;
const weak = fc.check(
  fc.property(...inputs, (capacity, operations) =>
    runSelfConsistency(capacity, operations, broken),
  ),
  propertyParameters,
);
assert.equal(weak.failed, false, "アクセサ同士は矛盾せず、この mutant を見逃すはず");

const property = fc.property(...inputs, (capacity, operations) =>
  runRingModel(capacity, operations, broken),
);
const result = fc.check(property, propertyParameters);
assert.ok(
  result.failed && result.counterexample !== null,
  "参照モデルは mutant の反例を見つけるはず",
);

// 同じ seed / path で、縮小された反例を再現できることも確認する。
const replay = fc.check(property, {
  ...propertyParameters,
  seed: result.seed,
  path: result.counterexamplePath,
  endOnFailure: true,
});
assert.deepEqual(replay.counterexample, result.counterexample);

console.log("アクセサ同士の整合性: PASS（データ消失を見逃す）");
console.log("配列の参照モデル: FAIL（データ消失を検出）");
console.log(
  JSON.stringify(
    {
      seed: result.seed,
      path: result.counterexamplePath,
      numShrinks: result.numShrinks,
      counterexample: result.counterexample,
    },
    null,
    2,
  ),
);
