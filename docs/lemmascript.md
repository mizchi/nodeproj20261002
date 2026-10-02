# LemmaScript でリングバッファの状態遷移を証明する

[SpecCraft の紹介](https://speccraft.io/typescript-formal-methods/lemmascript/)を参考に、LemmaScript **0.6.4** と Dafny **4.11.0** を使います。TypeScript の `//@ requires` と `//@ ensures` を Dafny に変換し、バックエンドの検証器で契約を証明します。

## 再現する

Node.js 24 以上、pnpm、just、unzip が必要です。

```sh
just install
just setup-proof   # 公式 release の SHA-256 を確認し、.tools 内に展開
just formal        # 正しい実装の証明と、既知の変異の拒否
```

`setup-proof` は macOS arm64 / x64 と Linux x64 に対応しています。それ以外では Dafny 4.11.0 を PATH に用意します。グローバル npm パッケージや .NET SDK のインストールは不要です。配布物に実行環境と Z3 が含まれます。

個別のコマンド:

```sh
just prove         # LemmaScript-files.txt の全対象を生成・検証
just prove-regen   # TypeScript の変更を .dfy にマージして再検証
just proof-failure # read / write の 0 件ガードを除く変異を拒否
```

pnpm では `pnpm proof`、`pnpm proof:regen`、`pnpm demo:proof-failure` です。

## 実装と証明を共有する

`src/ring-cursor.ts` に位置と満杯フラグだけを操作する純粋関数を置きました。`src/ring-buffer.ts` の `length` / `completeWrite` / `completeRead` がその関数を呼び、更新結果を実際の状態に適用します。証明用に別の状態遷移を作っているわけではありません。

検証対象は `cursorLength`、`commitWrite`、`commitRead` と、内部で使う `lengthValue`、`advanceIndex`、`fullAfterWrite`、`fullAfterRead` の計 7 関数です。[Uneffect の検査](uneffect.md)でも同じスカラー関数を使います。事前条件は次のとおりです。

- 容量は正の整数。
- `front` / `back` は `0 <= index < capacity`。
- `full` のときは `front === back`。
- 確定件数は 0 以上の整数。write は空き容量以下、read は保持件数以下。

例えば read の主要な契約は、実装内に次のコメントとして書いています。

```ts
//@ requires count >= 0 && count <= cursorLength(capacity, cursor)
//@ ensures cursorLength(capacity, \result) === cursorLength(capacity, cursor) - count
//@ ensures \result.back === cursor.back
//@ ensures count === 0 ==> \result.front === cursor.front && \result.full === cursor.full
```

これらに加え、更新後のインデックス範囲と `full` の整合性も証明します。write は長さが `count` 増え、read は `count` 減り、0 件ならカーソルの全フィールドを保持します。`cursorLength` は `0 <= length <= capacity` と `length === capacity` と `full` の同値を証明します。

実行結果:

```text
Dafny program verifier finished with 18 verified, 0 errors
```

この 18 はバックエンドが報告する検証単位の数で、テスト件数ではありません。容量 1〜3 や操作列長 4 といった全探索の上限を証明に持ち込んでいません。合法な状態に対する 1 回の更新で不変条件が維持されるため、合法な更新を繰り返す場合にもカーソルの不変条件は維持されます。

`proofs/src/ring-cursor.dfy.gen` は自動生成、`.dfy` は生成結果と追加の証明を置くファイルです。今回は手書きの補題や `assume` は不要で、2 ファイルの内容は同じです。`lsc check` は `.dfy.gen` を再生成し、`.dfy` が生成行を変更・削除していないことも確認します。変更時は `regen` でマージします。[公式の更新手順](https://github.com/midspiral/LemmaScript/blob/main/GETTING_STARTED.md)

## バグを入れると失敗する

`examples/ring-proof-failure.ts` は実装の一時コピーを作り、契約を保ったまま read / write の 0 件ガードをそれぞれ外します。どちらも検証器が事後条件を証明できず、終了コード 1 になります。スクリプト全体は両方を検出したときだけ成功します。構文エラーやツール未導入を「バグの検出」として数えません。

```text
read の 0 件ガードを除去: 契約違反を検出
Dafny program verifier finished with 16 verified, 2 errors

write の 0 件ガードを除去: 契約違反を検出
Dafny program verifier finished with 16 verified, 2 errors
```

壊れるのはスカラー関数の 0 件時の保持と、カーソル全体の長さの増減の契約です。具体例は次のとおりです。

| 操作       | 入力                                       | 誤った結果   |
| ---------- | ------------------------------------------ | ------------ |
| read 0 件  | 容量 1、`front = back = 0`、`full = true`  | 長さが 1 → 0 |
| write 0 件 | 容量 1、`front = back = 0`、`full = false` | 長さが 0 → 1 |

この表の具体例は手元で再現したものです。`lsc check` 自体は具体的な入力や縮小された反例を出しません。read の反例は `just counterexample` で fast-check が生成・縮小・seed/path による再現を行い、`tests/ring-buffer.regression.test.ts` と `tests/ring-cursor.test.ts` でも保持しています。

## Kani との違いと証明範囲

| 観点               | Kani                                                         | 今回の LemmaScript + Dafny               |
| ------------------ | ------------------------------------------------------------ | ---------------------------------------- |
| 入力の表現         | harness で `kani::any()` と `kani::assume()`                 | 関数の引数と `requires`                  |
| 性質の表現         | `assert!` など                                               | `ensures`                                |
| 検査するプログラム | Rust の実装をモデル検査器に変換                              | 対応する TypeScript を Dafny に変換      |
| ループ             | 通常は展開上限を扱う。loop contract による帰納的な検証も可能 | 不変条件・停止性の証明。今回はループなし |
| 数値               | Rust の型に応じた機械数の振る舞い                            | `number` を既定で数学的整数として扱う    |
| 今回の反例の縮小   | 使用していない                                               | fast-check に任せる                      |

「任意の合法入力に対して性質を検査する」という役割は近いですが、数値モデルと検査対象の範囲は異なります。[LemmaScript の公式仕様](https://github.com/midspiral/LemmaScript/blob/main/SPEC.md)は IEEE 754 の丸め、NaN、Infinity などを扱わないと明記しています。

Kani も実験的な [loop contract](https://model-checking.github.io/kani/reference/experimental/loop-contracts.html)でループ不変条件を検証し、展開上限に依存しない証明へ進めます。ここでの比較は記事の harness と今回の関数契約を中心にしています。[Kani の harness の例](https://github.com/model-checking/kani)、[ループ展開の説明](https://model-checking.github.io/kani/tutorial-loop-unwinding.html)

今回の整数計算を JavaScript の実行結果に対応させるには、入力と中間値を安全な整数範囲に収める必要があります。`advanceIndex` は末尾までの残りで分岐し、先に `index + count` を計算する方式の丸めを避けます。合法な整数入力で `capacity <= Number.MAX_SAFE_INTEGER` なら、この分岐の中間値は安全な整数範囲に収まります。Dafny 自体の数値モデルは数学的整数であり、IEEE 754 全般を証明するものではありません。実際のストレージを割り当てられるかどうかも証明対象に含みません。

証明済みなのはカーソルの長さ・位置・満杯フラグの更新です。`Uint8Array.set` / `subarray` によるコピー、FIFO のバイト列、入出力のエイリアス、不正入力の例外、呼び出し側の事前条件遵守、生成器の正しさは形式証明していません。コピーや FIFO は参照モデルによる PBT と限定全探索、不正入力は単体テスト、既知の反例は回帰テストで検査します。ストレージのエイリアスは API の契約で除外しています。

コードの分割後も、Stryker はコピー部分と純粋関数の両方を変異対象にしています。長さ 0 を除く PBT は 97 件中 4 件を見逃し、長さ 0 を含めると 97 件すべてを検出しました。形式証明の成功を理由にテストの対象を減らしてはいません。
