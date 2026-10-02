import fc from "fast-check";
import type { Operation } from "./ring-model.ts";

export const capacityArbitrary = fc.integer({ min: 1, max: 8 });
export const propertyParameters = { seed: 20_261_002, numRuns: 250 };

export function operationSequences(allowZeroLength = true): fc.Arbitrary<Operation[]> {
  const minLength = allowZeroLength ? 0 : 1;
  const operation: fc.Arbitrary<Operation> = fc.oneof(
    fc.record({
      kind: fc.constant("write" as const),
      bytes: fc.array(fc.integer({ min: 0, max: 255 }), { minLength, maxLength: 8 }),
    }),
    fc.record({
      kind: fc.constant("read" as const),
      count: fc.integer({ min: minLength, max: 8 }),
    }),
    fc.constant({ kind: "clear" as const }),
  );
  return fc.array(operation, { minLength: 0, maxLength: 48 });
}
