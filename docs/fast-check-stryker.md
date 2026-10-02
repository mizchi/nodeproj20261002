# Stryker と fast-check でリングバッファのテストの穴を埋める

mizchi の[「cargo-mutants でテストの穴を測って、proptest と kani で埋める」](https://zenn.dev/mizchi/articles/rust-mutants-proptest-kani)の流れを TypeScript で再現します。

| 記事での役割                                   | このプロジェクト                       |
| ---------------------------------------------- | -------------------------------------- |
| 実装を変えてテストの抜けを測る                 | StrykerJS + Vitest runner              |
| ランダムな操作列を独立した参照モデルと比較する | fast-check + JavaScript の配列         |
| 反例を得て再現・回帰テスト化する               | fast-check の shrinking と seed / path |
| 小さな入力空間をすべて検査する                 | 4,665 ケースの具体的な全探索           |
| スカラー契約と副作用の上限を検査する           | Uneffect + Z3                          |

全探索は以下で定義した入力範囲に対する検査です。Kani の記号実行や形式証明を実装したものではありません。
[Uneffect の実験](uneffect.md)でスカラー契約を `verified`、副作用の上限を `declared` のプロファイルで検査します。

## 再現する

Node.js 24 以上、pnpm 10.28.2、just を使います。

```sh
just install
just experiment
```

個別に実行する場合:

```sh
just test-property        # 参照モデルの PBT
just mutate-ring-unit     # 通常テストのみ
just mutate-ring-positive # 通常テスト + 長さ 0 を除く PBT
just mutate-ring-property # 通常テスト + 長さ 0 を含む PBT
just counterexample       # 既知の mutant に反例を生成・縮小・再現
just test-exhaustive      # 限定した入力範囲の全探索
just formal-uneffect      # スカラー契約・副作用を検査し、反例を得て実行時にも再現
```

日常の変更には `just mutate-changed` で変更行だけを検査できます。ブランチ比較や範囲を広げる条件は[差分ミューテーションテスト](mutation-diff.md)を参照してください。

## 題材と契約

状態は `src/ring-buffer.types.ts`、コピーと検証は `src/ring-buffer.ts`、純粋な状態遷移は `src/ring-cursor.ts` に分けています。ライブラリからは `ring` 名前空間で使えます。

```ts
import { ring } from "nodeproj20261002";

const state = ring.create(4);
const written = ring.write(state, Uint8Array.of(1, 2));
ring.completeWrite(state, written);

const output = new Uint8Array(2);
const count = ring.read(state, output);
ring.completeRead(state, count);
```

- 容量は正の安全な整数。不正な容量は `RangeError`。
- `write` は空き容量までコピーして件数を返す。`completeWrite` で件数を確定する。
- `read` は保持している件数までコピーする。出力の残りは変更せず、`completeRead` で件数を消費する。
- 確定数は 0 以上の整数で、書き込みは空き容量、読み込みは保持件数以下。不正な件数は `RangeError`。
- 0 件の確定は状態を変えない。`clear` は保持データを空にする。
- `readable` は FIFO 順の 2 つの借用ビューを返す。次の書き込み前に消費する。
- インデックスと `full` は操作関数を通じて変更する。読み書きの入出力バッファは内部ストレージと共有しない。

`front === back` の状態は空と満杯の両方で発生するため、`full` で区別します。

## 参照モデルを外に置く

`tests/support/ring-model.ts` では、配列を FIFO の正解として使います。書き込みは空き容量まで `push`、読み込みは先頭を `slice` で比較して `splice` で消費、クリアは配列を空にします。リングのインデックス計算を参照モデルにコピーしません。

操作ごとに、戻り値・読み出したバイト列・保持件数・空き容量・空 / 満杯・`readable` の内容を参照モデルと照合します。

`tests/support/ring-arbitraries.ts` の生成範囲:

| 項目           | 範囲                     |
| -------------- | ------------------------ |
| 容量           | 1〜8                     |
| 書き込みデータ | 0〜8 バイト、値は 0〜255 |
| 読み込み要求   | 0〜8 バイト              |
| 操作           | write / read / clear     |
| 操作列の長さ   | 0〜48                    |
| 試行数 / seed  | 250 / 20261002           |

seed を固定し、Stryker の初回実行と変異検証で同じ入力を使います。比較用の生成器は書き込みデータと読み込み要求の最小長だけを 1 に変えています。

## 生存 mutant を読む

`src/ring-buffer.ts` と `src/ring-cursor.ts` に生まれた 97 個の変異を、それぞれのテスト構成で計測した結果です。変異の除外は行っていません。

| テスト構成                          | Killed | Survived | NoCoverage | スコア |
| ----------------------------------- | ------ | -------- | ---------- | ------ |
| 通常テスト 14 件                    | 64     | 28       | 5          | 65.98% |
| 通常テスト + 長さ 0 を除く PBT 1 件 | 93     | 4        | 0          | 95.88% |
| 通常テスト + 長さ 0 を含む PBT 1 件 | 97     | 0        | 0          | 100%   |

長さ 0 を除くと、次の 4 件が生き残りました。

| 場所             | 変異                       | 見逃す入力                                  |
| ---------------- | -------------------------- | ------------------------------------------- |
| `fullAfterWrite` | `count > 0` → `true`       | 空のバッファへ 0 件確定すると満杯扱いになる |
| `fullAfterWrite` | `count > 0` → `count >= 0` | 同上                                        |
| `fullAfterRead`  | `count > 0` → `true`       | 満杯のバッファを 0 件消費すると空扱いになる |
| `fullAfterRead`  | `count > 0` → `count >= 0` | 同上                                        |

正しい実装ではどちらの生成器も成功します。Stryker を組み合わせることで、生成器が見逃している入力を判別できます。

HTML / JSON のレポートは `reports/mutation/ring-unit.{html,json}`、`ring-positive.{html,json}`、`ring-property.{html,json}`。HTML で生存した式、JSON で位置と検出したテストを確認できます。

比較では設定の `testFiles` で対象を固定しています。全探索や明示的な回帰テストを混ぜて PBT の効果を計測することを避けるためです。`just verify` はそれらも含む全テストと、送料・リングバッファ両方の変異を検証します。

## harness 自体の穴と縮小された反例

`examples/ring-counterexample.ts` は `completeRead` の 0 件ガードを取り除いた既知のバグを注入します。

同じ入力を使って、次の 2 つの harness を実行します。

1. アクセサ同士の整合性: `length + available === capacity`、空 / 満杯、ビュー長を互いに比較。このバグを見逃します。
2. 配列の参照モデル: 書き込んだ内容が失われているため失敗します。

fast-check が縮小した反例:

```json
{
  "seed": 20261002,
  "path": "87:2:0:2:6",
  "numShrinks": 4,
  "counterexample": [
    1,
    [
      { "kind": "write", "bytes": [0] },
      { "kind": "read", "count": 0 }
    ]
  ]
}
```

容量 1 に 1 バイト書いて満杯にし、0 バイト読むと、誤った実装では `full` が落ちます。すべてのアクセサは同じ壊れた状態から値を返すため、互いの整合性は維持されます。

スクリプトはこの反例を同じ seed / path で再現できることまで確認して成功終了します。検出失敗や再現失敗はエラーにします。`tests/ring-buffer.regression.test.ts` にこの最小例を固定した回帰テストも追加しています。

## 全探索の範囲

`tests/ring-buffer.exhaustive.test.ts` は容量 1〜3、操作列の長さ 0〜4、次の 6 操作の組み合わせをすべて参照モデルと比較します。

- 空 / `[0]` / `[1]` の書き込み
- 0 / 1 バイトの読み込み
- クリア

ケース数は `3 × (1 + 6 + 6² + 6³ + 6⁴) = 4,665`。この有限集合について全件成功したことを確認します。PBT の生成範囲全体や任意の容量・操作列に対する証明には拡張しません。

fast-check の公式資料: [Quick Start](https://fast-check.dev/docs/tutorials/quick-start/)、[assert / check](https://fast-check.dev/docs/core-blocks/runners/)。
