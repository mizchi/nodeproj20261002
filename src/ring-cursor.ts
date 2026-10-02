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
  //@ verify
  //@ requires capacity > 0
  //@ requires front >= 0 && front < capacity
  //@ requires back >= 0 && back < capacity
  //@ requires !full || front === back
  //@ ensures \result >= 0 && \result <= capacity
  //@ ensures (\result === capacity) === full
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
  //@ verify
  //@ requires capacity > 0
  //@ requires index >= 0 && index < capacity
  //@ requires count >= 0 && count <= capacity
  //@ ensures \result >= 0 && \result < capacity
  //@ ensures count === 0 ==> \result === index
  //@ ensures \result === (index + count) % capacity
  // count <= capacity なので折り返しは 1 回。index + count の桁あふれも避ける。
  const remaining = capacity - index;
  return count >= remaining ? count - remaining : index + count;
}

/* uneffect:effect none */
/* uneffect:requires count >= 0 */
/* uneffect:ensures count !== 0 || result === full */
/* uneffect:ensures count === 0 || result === (front === back) */
export function fullAfterWrite(front: number, back: number, full: boolean, count: number): boolean {
  //@ verify
  //@ requires count >= 0
  //@ ensures count === 0 ==> \result === full
  //@ ensures count > 0 ==> \result === (front === back)
  return count > 0 ? front === back : full;
}

/* uneffect:effect none */
/* uneffect:requires count >= 0 */
/* uneffect:ensures count !== 0 || result === full */
/* uneffect:ensures count === 0 || !result */
export function fullAfterRead(full: boolean, count: number): boolean {
  //@ verify
  //@ requires count >= 0
  //@ ensures count === 0 ==> \result === full
  //@ ensures count > 0 ==> !\result
  return count > 0 ? false : full;
}

/* uneffect:effect none */
export function cursorLength(capacity: number, cursor: RingCursor): number {
  //@ verify
  //@ requires capacity > 0
  //@ requires cursor.front >= 0 && cursor.front < capacity
  //@ requires cursor.back >= 0 && cursor.back < capacity
  //@ requires !cursor.full || cursor.front === cursor.back
  //@ ensures \result >= 0 && \result <= capacity
  //@ ensures (\result === capacity) === cursor.full
  return lengthValue(capacity, cursor.front, cursor.back, cursor.full);
}

/* uneffect:effect none */
export function commitWrite(capacity: number, cursor: RingCursor, count: number): RingCursor {
  //@ verify
  //@ requires capacity > 0
  //@ requires cursor.front >= 0 && cursor.front < capacity
  //@ requires cursor.back >= 0 && cursor.back < capacity
  //@ requires !cursor.full || cursor.front === cursor.back
  //@ requires count >= 0 && count <= capacity - cursorLength(capacity, cursor)
  //@ ensures \result.front >= 0 && \result.front < capacity
  //@ ensures \result.back >= 0 && \result.back < capacity
  //@ ensures !\result.full || \result.front === \result.back
  //@ ensures cursorLength(capacity, \result) === cursorLength(capacity, cursor) + count
  //@ ensures \result.front === cursor.front
  //@ ensures count === 0 ==> \result.back === cursor.back && \result.full === cursor.full
  const back = advanceIndex(capacity, cursor.back, count);
  return {
    front: cursor.front,
    back,
    full: fullAfterWrite(cursor.front, back, cursor.full, count),
  };
}

/* uneffect:effect none */
export function commitRead(capacity: number, cursor: RingCursor, count: number): RingCursor {
  //@ verify
  //@ requires capacity > 0
  //@ requires cursor.front >= 0 && cursor.front < capacity
  //@ requires cursor.back >= 0 && cursor.back < capacity
  //@ requires !cursor.full || cursor.front === cursor.back
  //@ requires count >= 0 && count <= cursorLength(capacity, cursor)
  //@ ensures \result.front >= 0 && \result.front < capacity
  //@ ensures \result.back >= 0 && \result.back < capacity
  //@ ensures !\result.full || \result.front === \result.back
  //@ ensures cursorLength(capacity, \result) === cursorLength(capacity, cursor) - count
  //@ ensures \result.back === cursor.back
  //@ ensures count === 0 ==> \result.front === cursor.front && \result.full === cursor.full
  return {
    front: advanceIndex(capacity, cursor.front, count),
    back: cursor.back,
    full: fullAfterRead(cursor.full, count),
  };
}
