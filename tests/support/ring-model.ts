import assert from "node:assert/strict";
import * as ring from "../../src/ring-buffer.ts";
import type { RingBufferState } from "../../src/ring-buffer.types.ts";

export type Operation =
  | { readonly kind: "write"; readonly bytes: readonly number[] }
  | { readonly kind: "read"; readonly count: number }
  | { readonly kind: "clear" };

export type RingApi = typeof ring;

function contents(state: RingBufferState, api: RingApi): number[] {
  const [head, tail] = api.readable(state);
  return [...head, ...tail];
}

export function runRingModel(capacity: number, operations: readonly Operation[], api = ring): void {
  const state = api.create(capacity);
  const model: number[] = [];

  function compare(): void {
    assert.equal(api.capacity(state), capacity);
    assert.equal(api.length(state), model.length);
    assert.equal(api.available(state), capacity - model.length);
    assert.equal(api.isEmpty(state), model.length === 0);
    assert.equal(api.isFull(state), model.length === capacity);
    assert.deepEqual(contents(state, api), model);
  }

  compare();
  for (const operation of operations) {
    switch (operation.kind) {
      case "write": {
        const expected = Math.min(operation.bytes.length, capacity - model.length);
        assert.equal(api.write(state, Uint8Array.from(operation.bytes)), expected);
        api.completeWrite(state, expected);
        model.push(...operation.bytes.slice(0, expected));
        break;
      }
      case "read": {
        const output = new Uint8Array(operation.count).fill(0xaa);
        const expected = Math.min(operation.count, model.length);
        assert.equal(api.read(state, output), expected);
        assert.deepEqual([...output.subarray(0, expected)], model.slice(0, expected));
        assert.ok(output.subarray(expected).every((byte) => byte === 0xaa));
        api.completeRead(state, expected);
        model.splice(0, expected);
        break;
      }
      case "clear":
        api.clear(state);
        model.length = 0;
        break;
    }
    compare();
  }
}

/** 外部の正解を持たず、アクセサ同士の整合性だけを検査する弱い harness。 */
export function runSelfConsistency(
  capacity: number,
  operations: readonly Operation[],
  api = ring,
): void {
  const state = api.create(capacity);
  for (const operation of operations) {
    switch (operation.kind) {
      case "write":
        api.completeWrite(state, api.write(state, Uint8Array.from(operation.bytes)));
        break;
      case "read":
        api.completeRead(state, api.read(state, new Uint8Array(operation.count)));
        break;
      case "clear":
        api.clear(state);
        break;
    }
    const length = api.length(state);
    assert.ok(length >= 0 && length <= api.capacity(state));
    assert.equal(length + api.available(state), api.capacity(state));
    assert.equal(api.isEmpty(state), length === 0);
    assert.equal(api.isFull(state), length === api.capacity(state));
    assert.equal(contents(state, api).length, length);
  }
}
