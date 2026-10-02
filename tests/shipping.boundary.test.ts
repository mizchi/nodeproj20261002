import { describe, expect, test } from "vite-plus/test";
import { calculateShippingFee } from "../src/index.ts";

describe("calculateShippingFee の送料無料境界", () => {
  test.each([
    [4_999, 500],
    [5_000, 0],
    [5_001, 0],
  ])("小計 %i 円の通常送料は %i 円", (subtotal, expected) => {
    expect(calculateShippingFee(subtotal)).toBe(expected);
  });

  test("小計がちょうど 5,000 円でも速達料金は加算する", () => {
    expect(calculateShippingFee(5_000, true)).toBe(300);
  });
});
