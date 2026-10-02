/** インデックスと full は ring-buffer の関数を通じて変更する。 */
export interface RingBufferState {
  readonly buffer: Uint8Array;
  front: number;
  back: number;
  full: boolean;
}
