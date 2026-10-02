import fc from "fast-check";
import { test } from "vite-plus/test";
import {
  capacityArbitrary,
  operationSequences,
  propertyParameters,
} from "./support/ring-arbitraries.ts";
import { runRingModel } from "./support/ring-model.ts";

test("長さ 0 を除いた操作列で配列の参照モデルと一致する（比較用）", () => {
  fc.assert(
    fc.property(capacityArbitrary, operationSequences(false), (capacity, operations) => {
      runRingModel(capacity, operations);
    }),
    propertyParameters,
  );
});
