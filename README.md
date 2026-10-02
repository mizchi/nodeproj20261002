# nodeproj20261002

**StrykerJS のミューテーションテストを試すための TypeScript テストプロジェクトです。** Vite Plus 1.0.0 で初期化し、StrykerJS 10.0.0 と fast-check 4.10.2 でテストの抜けを測り、Uneffect 0.5.1 + Z3 で契約・副作用を検査します。

[cargo-mutants / proptest / Kani の記事](https://zenn.dev/mizchi/articles/rust-mutants-proptest-kani)と同じリングバッファの題材を追加しました。

## 解説

- [Stryker と fast-check の実験](docs/fast-check-stryker.md): 参照モデル、生成範囲、生き残る変異、反例の shrink・再現、限定全探索の手順と結果。
- [Git の差分だけを検査する](docs/mutation-diff.md): 変更行の選択、ブランチ比較、検査範囲を広げる条件、差分用レポート。
- [Uneffect による契約と副作用の検査](docs/uneffect.md): 検査対象、Z3 の反例、`verified` / `assumed` の違いと保証範囲。

## 検証レポート

`reports/` のファイルは各コマンドで生成されます。実行後にローカルで開いてください。

| 確認したい結果                         | レポート                                                                                                                                                                           | 生成するコマンド       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 全テストで検出した変異                 | [ミューテーション一覧](reports/mutation/mutation.html)                                                                                                                             | `just mutate`          |
| Git の差分で検出した変異               | [差分の結果](reports/mutation/changed.html)、[対象と判断理由](reports/mutation/changed-plan.json)                                                                                  | `just mutate-changed`  |
| 境界値テストを省いたときに生き残る変異 | [送料のデモ](reports/mutation/demo.html)                                                                                                                                           | `just mutate-demo`     |
| 通常テストと PBT の比較                | [通常テスト](reports/mutation/ring-unit.html)、[長さ 0 なしの PBT](reports/mutation/ring-positive.html)、[長さ 0 を含む PBT](reports/mutation/ring-property.html)                  | `just mutate-ring`     |
| Uneffect の契約・副作用・反例          | [契約](reports/uneffect/contracts.json)、[副作用](reports/uneffect/effects.json)、[read の反例](reports/uneffect/read-zero.json)、[write の反例](reports/uneffect/write-zero.json) | `just formal-uneffect` |

Stryker の HTML レポートでは、変異ごとの変更された式と、どのテストが検出したかを確認できます。同じ名前の JSON レポートも生成します。レポートと Stryker の作業ディレクトリは Git の管理対象から除外しています。

## 実験を再現する

```sh
just install
just formal-uneffect # 契約・副作用の検査と既知のバグの反例・実行時再現
just experiment  # ミューテーション比較・shrink・限定全探索・契約検査
```

通常テストだけで **64/97**、長さ 0 を除いた PBT で **93/97**、長さ 0 を含む PBT で **97/97** の変異を検出しました。[実験の手順と結果](docs/fast-check-stryker.md)に生成範囲、反例、各レポートを記載しています。

```sh
just check-uneffect          # verified で契約を検査、declared で副作用を検査
just counterexample-uneffect # read/write の 0 件ガードを外した反例を得て再現
```

契約は **63 obligations が verified、仮定 0 件**。副作用の検査は **assumed、組み込み契約の仮定 11 件**です。JSON の検証結果を `reports/uneffect/` に保存します。[検査対象・プロファイル・保証範囲](docs/uneffect.md)を参照してください。

## 開発

Node.js 24 以上、pnpm 10.28.2、just を使用します。

```sh
just install  # lockfile に従って依存をインストール
just test     # Vitest で単体テスト
just check    # フォーマット・lint・型チェック
just build    # vp pack でライブラリと型宣言をビルド
just verify   # check・test・build・ミューテーションテスト・契約と副作用の検査
```

`just watch` でテストを監視、`just fmt` でフォーマットを適用します。just がなくても `pnpm test`、`pnpm check`、`pnpm build` で実行できます。

変更したソースだけを素早く検査する場合は次を使います。テスト・設定・依存の変更がある場合は全ソースを検査します。[対象の選び方と保証範囲](docs/mutation-diff.md)を参照してください。

```sh
just mutate-changed                   # HEAD に対する未コミット差分
just mutate-changed --base origin/main # ブランチの分岐点からの差分
just mutate-changed --list             # 対象の表示のみ
```

GitHub Actions の [Mutation diff](.github/workflows/mutation-diff.yml) は PR のソース差分を `--diff-only` で検査します。ソース差分がなければスキップし、対象一覧と HTML / JSON レポートを artifact に保存します。CI ではテスト・設定・依存の変更から全ソース検査へ広げません。[CI の動作と手動実行](docs/mutation-diff.md#github-actions)を参照してください。

## ミューテーションテストを試す

`src/index.ts` の `calculateShippingFee(subtotal, express?)` は、小計 5,000 円以上で通常送料が無料になり、それ未満は 500 円。速達を指定すると別途 300 円を加算します。小計には非負の整数を円単位で渡す想定です。

まず、境界値のテストを除いた状態で実行します。

```sh
just mutate-demo
# pnpm test:mutation stryker.demo.config.mjs でも実行可能
```

通常の 4 テストは成功しますが、Stryker が `subtotal >= 5_000` を `subtotal > 5_000` に変えても成功してしまいます。この変異は `Survived` となり、7 個の変異中 6 個を検出してスコアは **85.71%** になります。

次に、5,000 円ちょうどの境界値を含む全テストで実行します。現在はリングバッファも同時に検証します。

```sh
just mutate
# pnpm test:mutation でも実行可能
```

`tests/shipping.boundary.test.ts` がこの変異を検出し、送料の 7 個すべてが `Killed` になります。リングバッファの 97 個と合わせたスコアは **100%** です。

## 構成と互換性

- `vite.config.ts`: ビルド・単体テスト・lint・フォーマットの設定。
- `stryker.config.json`: `src/**/*.ts` を変異させ、`@stryker-mutator/vitest-runner` で検証。変異ごとに、それをカバーするテストを実行します。
- `stryker.demo.config.mjs`: 送料の通常ケースだけを実行する比較用設定。標準設定を読み込み、変異対象・テスト対象・レポートの出力先を変更します。
- `stryker.ring.config.mjs`: リングバッファだけを変異させ、通常テスト・長さ 0 なしの PBT・長さ 0 を含む PBT を比較します。
- `verification/ring-contracts.ts`: 実装と同じスカラー関数を呼び、read/write の長さの増減と 0 件操作の保持を Uneffect で検査します。

TypeScript は **6.0.3 に固定**しています。雛形の TypeScript 7.0.2 では、Stryker が使う `parseConfigFileTextToJson` API がなく、実行が失敗しました。型宣言も `tsc` で生成します。

Uneffect は数値契約を扱う `--typescript-program` 経路を使い、同梱コンパイラとプロジェクトの TypeScript が **6.0.3 / exact** で一致することを JSON で確認します。`pnpm-workspace.yaml` に、この経路で使う Uneffect 0.5.1 の TypeScript peer の例外を登録しています。

Vitest は Vite Plus と同じ **5.0.1**、`@stryker-mutator/vitest-runner` は **10.0.0** に固定しています。

Vitest 5 では `testNamePattern` に使うテストのフルネームが空白区切りから `>` 区切りに変わりました。runner 10.0.0 は空白区切りの名前を渡すため、`describe` 配下のテストが変異検証時に選択されず、全変異が `Survived` になっていました。

`patches/@stryker-mutator__vitest-runner@10.0.0.patch` で、runner とカバレッジ収集側の名前の組み立てを `>` 区切りに揃えています。`pnpm-workspace.yaml` の `patchedDependencies` に登録しており、`just install` 時にも適用されます。このパッチは Vitest 5 用です。runner を更新するときはパッチの要否を確認し、`just mutate-demo` が 85.71%、`just mutate` が 100% になることを検証してください。

公式ドキュメント: [Vite Plus のプロジェクト作成](https://viteplus.dev/guide/create)、[StrykerJS](https://github.com/stryker-mutator/stryker-js)、[Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)、[Vitest 5 のテスト名変更](https://vitest.dev/guide/migration/#testnamepattern-matches-the-joined-full-name)。
