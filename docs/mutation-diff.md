# Git の差分だけをミューテーションテストする

`just mutate-changed` は変更されたソースの行を Stryker の `mutate` に指定します。差分の取得は `scripts/mutation-git.ts`、対象の判断は `scripts/mutation-diff.ts`、実行は `scripts/mutation-changed.ts` に分けています。

## 使い方

Node.js 24 以上、pnpm 10.28.2、just を使用します。

```sh
just install
just mutate-changed                         # HEAD に対する未コミット差分
just mutate-changed --base origin/main       # ブランチの分岐点からの差分
just mutate-changed --base HEAD~1            # 直前のコミットからの差分
just mutate-changed --diff-only              # テスト・設定変更でも全ソースへ広げない
just mutate-changed --base origin/main --list # 対象を JSON で表示するだけ
```

pnpm では `pnpm test:mutation:changed` です。`--help` で引数の説明を表示します。

既定では `HEAD` と現在の作業ツリーを比較し、staged と unstaged の変更をまとめて検査します。gitignore の対象を除く未追跡のファイルも含みます。

`--base <ref>` では `HEAD` と比較先の merge-base を求め、そのコミットと現在の作業ツリーを比較します。ブランチ上のコミットと未コミットの変更が対象になり、比較先だけに追加された変更を含めません。比較先はローカルに存在する ref を指定してください。存在しない ref や Git のエラーは失敗終了します。

## 対象を選ぶ規則

ソースの対象は `stryker.config.json` の `mutate` と同じ、現在の `src/**/*.ts` です。

| 変更                                                                      | 検査する範囲                                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 既存ソースへの行追加・置き換え                                            | `git diff --unified=0` の新しい行番号。離れた hunk は別の範囲にする          |
| 新規・未追跡のソース                                                      | ファイル全体                                                                 |
| 行数が減る hunk・行 hunk のないソース変更                                 | そのファイル全体                                                             |
| ファイルの rename                                                         | 新しいパスのファイル全体。Git の rename 判定を無効にして削除と追加として扱う |
| ファイルの削除                                                            | 削除されたファイルは対象から外す                                             |
| `tests/` のテスト・参照モデルの変更                                       | 全ソース                                                                     |
| `package.json`、lockfile、workspace、TypeScript・Vite・Stryker 設定の変更 | 全ソース                                                                     |
| ドキュメントだけの変更・差分なし                                          | Stryker を起動せず成功終了                                                   |

行が削除された位置には現在のコードがないため、行数が減ったファイルは全体に広げます。既定ではテスト・参照モデル・設定・依存の変更があると全ソースを検査します。変更していないソースの検出結果にも影響するためです。実行時には範囲を広げた理由を表示します。

`--diff-only` ではテスト・設定・依存の変更で全ソースへ広げず、変更されたソースだけを選びます。ソース差分がなければスキップします。新規・rename・行数が減るソースのファイル全体を選ぶ規則は適用します。テストや依存の更新が変更していないソースに与える影響は、このモードの検査範囲に含めません。

## GitHub Actions

[`.github/workflows/mutation-diff.yml`](../.github/workflows/mutation-diff.yml) は PR と手動実行で動きます。CI では `--diff-only` を使います。

- PR の head コミットをチェックアウトし、PR イベントの base コミットとの merge-base から比較します。比較に必要な履歴を `fetch-depth: 0` で取得します。[checkout の公式設定](https://github.com/actions/checkout#checkout-pull-request-head-commit-instead-of-merge-commit)
- 最初に依存なしで対象を選び、ソース差分がなければ依存のインストールと Stryker をスキップします。
- 対象がある場合は Node.js 24、`package.json` に固定した pnpm、`pnpm install --frozen-lockfile` を使います。pnpm store をキャッシュします。
- 対象一覧と HTML / JSON の結果を `mutation-diff-<run_id>-<attempt>` artifact に 7 日間保存します。検査失敗時も保存します。

Actions の「Run workflow」では比較先 `base` を指定できます。既定の `HEAD~1` は直前のコミットからの差分を検査します。

ローカルで同じ範囲を検査する例:

```sh
just mutate-changed --base origin/main --diff-only
```

例えば新しいソースの 3 行目と 9〜10 行目を変更すると、Stryker に次を渡します。

```json
{
  "mutate": ["src/index.ts:3-3", "src/index.ts:9-10"]
}
```

パスは Git の NUL 区切り出力と Stryker のプログラム API で扱うため、空白・日本語・カンマを含むファイルも一つの対象として渡します。glob 記号などを含み Stryker の行範囲指定で曖昧になるパスは、意図しないファイルを選ばずエラーにします。

## 結果を読む

- `reports/mutation/changed-plan.json`: 比較先のコミット、変更ファイル、選択した行範囲、全体に広げた理由。
- `reports/mutation/changed.html`: 変異ごとの変更と検出結果。
- `reports/mutation/changed.json`: 同じ検査結果の JSON。

`--list` は計画を標準出力に表示し、レポートや作業ツリーを変更しません。通常実行で対象がない場合も計画を保存します。このとき HTML / JSON のミューテーション結果は生成・更新されません。レポートは Git の管理対象から除外しています。

スコアは選んだ範囲の結果です。Stryker の行範囲指定は、その範囲内に収まる構文ノードを変異させるため、範囲の外にまたがる関数やブロックの変異を網羅する保証はありません。全体の検査には `just mutate` / `just verify` を使います。[Stryker の行範囲指定](https://stryker-mutator.io/docs/stryker-js/configuration/#mutate-string)

差分実行でも最初にテストを実行してカバレッジを収集します。このプロジェクトの Vitest runner は対象ソースに関連するテストを選び、変異の検証ではそれをカバーするテストを実行します。[Vitest runner の related 設定](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)
