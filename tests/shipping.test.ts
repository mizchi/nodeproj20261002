import { describe, expect, test } from "vite-plus/test";
import { calculateShippingFee } from "../src/index.ts";

describe("calculateShippingFee", () => {
  test("送料無料の条件を満たさない通常配送は 500 円", () => {
    expect(calculateShippingFee(4_000)).toBe(500);
  });

  test("送料無料の条件を満たす通常配送は 0 円", () => {
    expect(calculateShippingFee(6_000)).toBe(0);
  });

  test("送料無料の条件を満たさない速達は 800 円", () => {
    expect(calculateShippingFee(4_000, true)).toBe(800);
  });

  test("送料無料の条件を満たしても速達料金 300 円は加算する", () => {
    expect(calculateShippingFee(6_000, true)).toBe(300);
  });
});
