# Uneffect でリングバッファの契約と副作用を検査する

[`mizchi/uneffect`](https://github.com/mizchi/uneffect) の npm パッケージ `@mizchi/uneffect` **0.5.1** を使います。仕様は通常の `/* uneffect:... */` コメントで記述し、実行時の effect ランタイムは追加しません。

```sh
just install
just formal-uneffect
```

個別には `just check-uneffect` と `just counterexample-uneffect`。pnpm では `pnpm check:uneffect`、`pnpm demo:uneffect-failure` です。Uneffect の検査は Node.js 24 とパッケージ内の Z3 対応で動作します。

## 検査対象と結果

| 対象                                                   | 検査                                         | assurance プロファイル | 結果                                    |
| ------------------------------------------------------ | -------------------------------------------- | ---------------------- | --------------------------------------- |
| `src/ring-cursor.ts`、`verification/ring-contracts.ts` | スカラーの事前条件・事後条件と宣言した副作用 | `verified`             | 63 obligations が `verified`、仮定 0 件 |
| `src/ring-buffer.ts` と参照先                          | コピー・状態更新・例外の副作用の上限         | `declared`             | `assumed`、組み込み契約の仮定 11 件     |

この環境の契約バックエンドは native Z3 **4.16.0** です。数値契約を検査できる `--typescript-program` を明示しています。Uneffect 同梱コンパイラと consumer の TypeScript は **6.0.3**、report の compiler parity は **exact**。一般の数値契約がまだ移行中のデフォルト Corsa/Oxc 経路は今回使いません。[公式 CLI の経路説明](https://github.com/mizchi/uneffect/blob/main/docs/cli.md)

コマンドは診断、solver 結果、制御経路、呼び出し先の契約、仮定、compiler 情報、assurance の claims / exclusions を含む JSON を保存します。

- `reports/uneffect/contracts.json`
- `reports/uneffect/effects.json`
- `reports/uneffect/read-zero.json`
- `reports/uneffect/write-zero.json`

成功判定では終了コードだけでなく、assurance の状態、空の仮定台帳、compiler parity、全 obligation の `verified` を確認します。6 個の対象関数に契約の検証結果が存在することも確認し、コメントを消して検査件数が 0 になった場合は失敗させます。

## 実装と同じ計算を検査する

Uneffect 0.5.1 は契約式の `cursor.front` のようなオブジェクト参照を未対応として拒否しました。この結果を成功扱いせず、実装の計算を次のスカラー関数に分けています。

- `lengthValue`: 容量、front、back、full から長さを求める。
- `advanceIndex`: 0〜容量の件数だけ位置を進める。
- `fullAfterRead` / `fullAfterWrite`: 確定件数に応じて満杯フラグを更新する。

カーソルの公開操作 `cursorLength` / `commitRead` / `commitWrite` がこれらを呼びます。`verification/ring-contracts.ts` の read / write harness も同じ関数を呼び、長さの増減と 0 件時の位置・満杯フラグの保持を検査します。事前条件は正の容量、範囲内のインデックス、満杯時の同一位置、合法な確定件数です。

例えば read の満杯フラグは次の契約を持ちます。

```ts
/* uneffect:effect none */
/* uneffect:requires count >= 0 */
/* uneffect:ensures count !== 0 || result === full */
/* uneffect:ensures count === 0 || !result */
export function fullAfterRead(full: boolean, count: number): boolean {
  return count > 0 ? false : full;
}
```

位置の更新は「末尾までの残りを引く」分岐に変えています。`index + count` を先に計算して `% capacity` を取る方式では、安全な整数の上限で加算が丸まる場合があります。現在は加算する分岐でも結果が容量未満になり、容量 `Number.MAX_SAFE_INTEGER` での 1 周もテストしています。

## 既知の変異と反例

`examples/ring-uneffect-failure.ts` は同じソースの一時コピーから、read / write の 0 件ガードをそれぞれ外します。契約と effect 宣言は保ちます。

read で `return false` とすると、Uneffect は `violated` と判定し、Z3 は **`full = true, count = 0`** を返します。write でガードを外した場合も `count = 0` の契約違反を得ます。

write の Z3 モデルはスカラー関数の事前条件に対する反例であり、リング全体で到達可能な状態を選ぶ保証はありません。スクリプトでは別途、壊した実装の一時コピーを実行し、容量 1 の合法な状態でも次を再現します。

| 操作       | read/write 前 | 誤った長さ |
| ---------- | ------------- | ---------- |
| read 0 件  | 満杯、長さ 1  | 0          |
| write 0 件 | 空、長さ 0    | 1          |

両方について `counterexample` artifact と `violated` が得られ、実行時にもバグを再現できた場合だけデモは成功終了します。未対応・solver 不在・`unknown` を反例として扱いません。

fast-check の生成・shrink・seed/path の再現は `just counterexample` に残しています。Z3 の反例に fast-check の shrinking を適用したわけではありません。

## 保証範囲

63 件は数学的整数と Boolean を使った、選択した scalar contract の検証単位です。合法な整数入力で容量を `Number.MAX_SAFE_INTEGER` 以下に限定しています。TypeScript の `number` 型だけでは整数性を保証しないため、API の容量・確定件数の実行時チェックと、状態を操作関数経由で更新する契約を保っています。

オブジェクトの組み立て・呼び出し側の事前条件遵守・任意の getter / Proxy・IEEE 754 全般・Uint8Array のコピーや FIFO の内容は、この `verified` の主張に含めません。構造化カーソルの更新とコピー・FIFO の内容は、単体テスト・参照モデルの PBT・限定全探索で検査します。

副作用検査の `assumed` は、Number と TypedArray の組み込み呼び出しの意味を Uneffect の契約カタログに依存することを表します。`Mutate<typeof state.buffer>`、位置・full の更新、`Throw<RangeError>` などの宣言上限を検査した結果であり、組み込み実装やヒープの一般的な正しさを証明した結果ではありません。[公式の保証範囲](https://github.com/mizchi/uneffect/blob/main/docs/assurance-boundaries.md)
