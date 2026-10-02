# nodeproj20261002

Vite Plus 1.0.0 で初期化した TypeScript ライブラリ。StrykerJS 10.0.0 と fast-check 4.10.2 でテストの抜けを測り、Uneffect 0.5.1 + Z3 で契約・副作用を検査します。LemmaScript 0.6.4 + Dafny 4.11.0 による状態遷移の証明も比較用に残しています。

[cargo-mutants / proptest / Kani の記事](https://zenn.dev/mizchi/articles/rust-mutants-proptest-kani)と同じリングバッファの題材を追加しました。

```sh
just install
just formal-uneffect # 契約・副作用の検査と既知のバグの反例・実行時再現
just setup-proof # Dafny を .tools 内に準備（初回のみ、unzip が必要）
just experiment  # ミューテーション比較・shrink・限定全探索・形式証明
```

通常テストだけで **64/97**、長さ 0 を除いた PBT で **93/97**、長さ 0 を含む PBT で **97/97** の変異を検出しました。[実験の手順と結果](docs/fast-check-stryker.md)に生成範囲、反例、各レポートを記載しています。

```sh
just check-uneffect          # verified で契約を検査、declared で副作用を検査
just counterexample-uneffect # read/write の 0 件ガードを外した反例を得て再現
```

契約は **63 obligations が verified、仮定 0 件**。副作用の検査は **assumed、組み込み契約の仮定 11 件**です。JSON の検証結果を `reports/uneffect/` に保存します。[検査対象・プロファイル・保証範囲](docs/uneffect.md)を参照してください。Uneffect 単独の検査には Dafny や Java は不要です。

```sh
just prove         # 任意の合法なカーソル・件数について契約を証明
just proof-failure # 0 件ガードを外した read/write のバグを両方検出
```

実装から呼び出す `src/ring-cursor.ts` の純粋関数を直接変換し、**18 verified, 0 errors**。インデックスの範囲、長さの増減、満杯の判定、0 件操作の保持を証明します。バイト列のコピーや JavaScript の浮動小数点全般は証明対象に含みません。[Kani との違いと証明範囲](docs/lemmascript.md)を参照してください。

## 開発

Node.js 24 以上、pnpm 10.28.2、just を使用します。

```sh
just install  # lockfile に従って依存をインストール
just test     # Vitest で単体テスト
just check    # フォーマット・lint・型チェック
just build    # vp pack でライブラリと型宣言をビルド
just verify   # check・test・build・ミューテーションテスト・形式証明
```

`just watch` でテストを監視、`just fmt` でフォーマットを適用します。just がなくても `pnpm test`、`pnpm check`、`pnpm build` で実行できます。

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

| 実行               | HTML レポート                    | JSON レポート                    |
| ------------------ | -------------------------------- | -------------------------------- |
| `just mutate-demo` | `reports/mutation/demo.html`     | `reports/mutation/demo.json`     |
| `just mutate`      | `reports/mutation/mutation.html` | `reports/mutation/mutation.json` |

HTML レポートをブラウザで開くと、変更された式と検出結果を確認できます。レポートと Stryker の作業ディレクトリは Git の管理対象から除外しています。

## 構成と互換性

- `vite.config.ts`: ビルド・単体テスト・lint・フォーマットの設定。
- `stryker.config.json`: `src/**/*.ts` を変異させ、`@stryker-mutator/vitest-runner` で検証。変異ごとに、それをカバーするテストを実行します。
- `stryker.demo.config.mjs`: 送料の通常ケースだけを実行する比較用設定。標準設定を読み込み、変異対象・テスト対象・レポートの出力先を変更します。
- `stryker.ring.config.mjs`: リングバッファだけを変異させ、通常テスト・長さ 0 なしの PBT・長さ 0 を含む PBT を比較します。
- `LemmaScript-files.txt`: 証明対象の TypeScript。生成物は `proofs/` に置き、`just prove` が生成との差分と証明を検証します。

TypeScript は **6.0.3 に固定**しています。雛形の TypeScript 7.0.2 では、Stryker が使う `parseConfigFileTextToJson` API がなく、実行が失敗しました。型宣言も `tsc` で生成します。

Uneffect は数値契約を扱う `--typescript-program` 経路を使い、同梱コンパイラとプロジェクトの TypeScript が **6.0.3 / exact** で一致することを JSON で確認します。`pnpm-workspace.yaml` に、この経路で使う Uneffect 0.5.1 の TypeScript peer の例外を登録しています。

Vitest は Vite Plus と同じ **5.0.1**、`@stryker-mutator/vitest-runner` は **10.0.0** に固定しています。

Vitest 5 では `testNamePattern` に使うテストのフルネームが空白区切りから `>` 区切りに変わりました。runner 10.0.0 は空白区切りの名前を渡すため、`describe` 配下のテストが変異検証時に選択されず、全変異が `Survived` になっていました。

`patches/@stryker-mutator__vitest-runner@10.0.0.patch` で、runner とカバレッジ収集側の名前の組み立てを `>` 区切りに揃えています。`pnpm-workspace.yaml` の `patchedDependencies` に登録しており、`just install` 時にも適用されます。このパッチは Vitest 5 用です。runner を更新するときはパッチの要否を確認し、`just mutate-demo` が 85.71%、`just mutate` が 100% になることを検証してください。

公式ドキュメント: [Vite Plus のプロジェクト作成](https://viteplus.dev/guide/create)、[StrykerJS](https://github.com/stryker-mutator/stryker-js)、[Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)、[Vitest 5 のテスト名変更](https://vitest.dev/guide/migration/#testnamepattern-matches-the-joined-full-name)。
