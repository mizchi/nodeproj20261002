import { advanceIndex, fullAfterRead, fullAfterWrite, lengthValue } from "../src/ring-cursor.ts";

// スカラーの harness から、実装で使う関数を直接呼んで read/write の契約を確認する。
// オブジェクトの組み立てと Uint8Array のコピーはこの harness の範囲外。
/* uneffect:effect none */
/* uneffect:requires capacity > 0 && capacity <= 9007199254740991 */
/* uneffect:requires front >= 0 && front < capacity */
/* uneffect:requires back >= 0 && back < capacity */
/* uneffect:requires !full || front === back */
/* uneffect:requires count >= 0 && count <= capacity */
/* uneffect:requires !full || count <= capacity */
/* uneffect:requires full || front > back || count <= back - front */
/* uneffect:requires full || front <= back || count <= capacity - front + back */
/* uneffect:ensures result === true */
export function readContract(
  capacity: number,
  front: number,
  back: number,
  full: boolean,
  count: number,
): boolean {
  const before = lengthValue(capacity, front, back, full);
  const nextFront = advanceIndex(capacity, front, count);
  const nextFull = fullAfterRead(full, count);
  const after = lengthValue(capacity, nextFront, back, nextFull);
  return after === before - count && (count !== 0 || (nextFront === front && nextFull === full));
}

/* uneffect:effect none */
/* uneffect:requires capacity > 0 && capacity <= 9007199254740991 */
/* uneffect:requires front >= 0 && front < capacity */
/* uneffect:requires back >= 0 && back < capacity */
/* uneffect:requires !full || front === back */
/* uneffect:requires count >= 0 && count <= capacity */
/* uneffect:requires !full || count === 0 */
/* uneffect:requires full || front > back || count <= capacity - back + front */
/* uneffect:requires full || front <= back || count <= front - back */
/* uneffect:ensures result === true */
export function writeContract(
  capacity: number,
  front: number,
  back: number,
  full: boolean,
  count: number,
): boolean {
  const before = lengthValue(capacity, front, back, full);
  const nextBack = advanceIndex(capacity, back, count);
  const nextFull = fullAfterWrite(front, nextBack, full, count);
  const after = lengthValue(capacity, front, nextBack, nextFull);
  return after === before + count && (count !== 0 || (nextBack === back && nextFull === full));
}
