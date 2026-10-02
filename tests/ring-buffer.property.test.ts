import fc from "fast-check";
import { test } from "vite-plus/test";
import {
  capacityArbitrary,
  operationSequences,
  propertyParameters,
} from "./support/ring-arbitraries.ts";
import { runRingModel } from "./support/ring-model.ts";

test("長さ 0 を含む操作列で配列の参照モデルと一致する", () => {
  fc.assert(
    fc.property(capacityArbitrary, operationSequences(), (capacity, operations) => {
      runRingModel(capacity, operations);
    }),
    propertyParameters,
  );
});
