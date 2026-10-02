import type { RingBufferState } from "./ring-buffer.types.ts";
import { commitRead, commitWrite, cursorLength } from "./ring-cursor.ts";

/* uneffect:effect Throw<RangeError> */
function validateCount(count: number, limit: number): void {
  if (!Number.isInteger(count) || count < 0 || count > limit) {
    throw new RangeError();
  }
}

/* uneffect:effect Throw<RangeError> */
export function create(capacity: number): RingBufferState {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError();
  }
  return { buffer: new Uint8Array(capacity), front: 0, back: 0, full: false };
}

/* uneffect:effect none */
export function capacity(state: RingBufferState): number {
  return state.buffer.length;
}

/* uneffect:effect none */
export function length(state: RingBufferState): number {
  return cursorLength(capacity(state), state);
}

/* uneffect:effect none */
export function available(state: RingBufferState): number {
  return capacity(state) - length(state);
}

/* uneffect:effect none */
export function isEmpty(state: RingBufferState): boolean {
  return length(state) === 0;
}

/* uneffect:effect none */
export function isFull(state: RingBufferState): boolean {
  return state.full;
}

/** 空き容量分までコピーし、書き込み位置の更新は completeWrite に任せる。 */
/* uneffect:effect Mutate<typeof state.buffer> */
export function write(state: RingBufferState, input: Uint8Array): number {
  const count = Math.min(input.length, available(state));
  const first = Math.min(count, capacity(state) - state.back);
  state.buffer.set(input.subarray(0, first), state.back);
  state.buffer.set(input.subarray(first, count), 0);
  return count;
}

/* uneffect:effect Mutate<typeof state.back> | Mutate<typeof state.full> | Throw<RangeError> */
export function completeWrite(state: RingBufferState, count: number): void {
  validateCount(count, available(state));
  const next = commitWrite(capacity(state), state, count);
  state.back = next.back;
  state.full = next.full;
}

/** 保持しているデータまでコピーし、読み込み位置の更新は completeRead に任せる。 */
/* uneffect:effect Mutate<typeof output> */
export function read(state: RingBufferState, output: Uint8Array): number {
  const count = Math.min(output.length, length(state));
  const first = Math.min(count, capacity(state) - state.front);
  output.set(state.buffer.subarray(state.front, state.front + first));
  output.set(state.buffer.subarray(0, count - first), first);
  return count;
}

/* uneffect:effect Mutate<typeof state.front> | Mutate<typeof state.full> | Throw<RangeError> */
export function completeRead(state: RingBufferState, count: number): void {
  validateCount(count, length(state));
  const next = commitRead(capacity(state), state, count);
  state.front = next.front;
  state.full = next.full;
}

/* uneffect:effect Mutate<typeof state.front> | Mutate<typeof state.full> */
export function clear(state: RingBufferState): void {
  state.front = state.back;
  state.full = false;
}

/** FIFO 順の借用ビュー。次の書き込み前に消費する。 */
/* uneffect:effect none */
export function readable(state: RingBufferState): readonly [Uint8Array, Uint8Array] {
  const first = Math.min(length(state), capacity(state) - state.front);
  return [
    state.buffer.subarray(state.front, state.front + first),
    state.buffer.subarray(0, length(state) - first),
  ];
}
