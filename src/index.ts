/** 通常送料は 500 円。小計 5,000 円以上で無料、速達は別途 300 円。 */
export function calculateShippingFee(subtotal: number, express = false): number {
  const baseFee = subtotal >= 5_000 ? 0 : 500;
  return express ? baseFee + 300 : baseFee;
}
export * as ring from "./ring-buffer.ts";
export type { RingBufferState } from "./ring-buffer.types.ts";
