/** バイト列を持たない、リングバッファの位置と満杯フラグ。 */
export interface RingCursor {
  readonly front: number;
  readonly back: number;
  readonly full: boolean;
}

/* uneffect:effect none */
/* uneffect:requires capacity > 0 && capacity <= 9007199254740991 */
/* uneffect:requires front >= 0 && front < capacity */
/* uneffect:requires back >= 0 && back < capacity */
/* uneffect:requires !full || front === back */
/* uneffect:ensures result >= 0 && result <= capacity */
/* uneffect:ensures (result === capacity) === full */
/* uneffect:ensures !full || result === capacity */
/* uneffect:ensures full || front > back || result === back - front */
/* uneffect:ensures full || front <= back || result === capacity - front + back */
export function lengthValue(capacity: number, front: number, back: number, full: boolean): number {
  if (full) return capacity;
  if (front <= back) return back - front;
  return capacity - front + back;
}

/* uneffect:effect none */
/* uneffect:requires capacity > 0 && capacity <= 9007199254740991 */
/* uneffect:requires index >= 0 && index < capacity */
/* uneffect:requires count >= 0 && count <= capacity */
/* uneffect:ensures result >= 0 && result < capacity */
/* uneffect:ensures count !== 0 || result === index */
/* uneffect:ensures count < capacity - index || result === count - (capacity - index) */
/* uneffect:ensures count >= capacity - index || result === index + count */
export function advanceIndex(capacity: number, index: number, count: number): number {
  // count <= capacity なので折り返しは 1 回。index + count の桁あふれも避ける。
  const remaining = capacity - index;
  return count >= remaining ? count - remaining : index + count;
}

/* uneffect:effect none */
/* uneffect:requires count >= 0 */
/* uneffect:ensures count !== 0 || result === full */
/* uneffect:ensures count === 0 || result === (front === back) */
export function fullAfterWrite(front: number, back: number, full: boolean, count: number): boolean {
  return count > 0 ? front === back : full;
}

/* uneffect:effect none */
/* uneffect:requires count >= 0 */
/* uneffect:ensures count !== 0 || result === full */
/* uneffect:ensures count === 0 || !result */
export function fullAfterRead(full: boolean, count: number): boolean {
  return count > 0 ? false : full;
}

/* uneffect:effect none */
export function cursorLength(capacity: number, cursor: RingCursor): number {
  return lengthValue(capacity, cursor.front, cursor.back, cursor.full);
}

/* uneffect:effect none */
export function commitWrite(capacity: number, cursor: RingCursor, count: number): RingCursor {
  const back = advanceIndex(capacity, cursor.back, count);
  return {
    front: cursor.front,
    back,
    full: fullAfterWrite(cursor.front, back, cursor.full, count),
  };
}

/* uneffect:effect none */
export function commitRead(capacity: number, cursor: RingCursor, count: number): RingCursor {
  return {
    front: advanceIndex(capacity, cursor.front, count),
    back: cursor.back,
    full: fullAfterRead(cursor.full, count),
  };
}
