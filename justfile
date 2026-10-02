default:
    @just --list

# 依存関係をインストール
install:
    pnpm install --frozen-lockfile

# フォーマット・lint・型を検証
check:
    pnpm check

# フォーマットを適用
fmt:
    pnpm fmt

# 単体テスト
test *args:
    pnpm test {{ args }}

# 単体テストを監視
watch:
    pnpm test:watch

# ライブラリをビルド
build:
    pnpm build

# 全テストでミューテーションテスト
mutate *args:
    pnpm test:mutation {{ args }}

# 境界値テストを除いて生き残る変異を観察
mutate-demo:
    pnpm test:mutation stryker.demo.config.mjs

# 参照モデルによる property-based test
test-property:
    pnpm test tests/ring-buffer.property.test.ts

# 限定した入力空間を全探索
test-exhaustive:
    pnpm test tests/ring-buffer.exhaustive.test.ts

# 通常テストだけでリングバッファの変異を計測
mutate-ring-unit:
    RING_TEST_SUITE=unit pnpm test:mutation stryker.ring.config.mjs

# 長さ 0 を除いた生成器で計測
mutate-ring-positive:
    RING_TEST_SUITE=positive pnpm test:mutation stryker.ring.config.mjs

# 長さ 0 を含む生成器で計測
mutate-ring-property:
    RING_TEST_SUITE=property pnpm test:mutation stryker.ring.config.mjs

# 3 種類のテスト構成を順番に比較
mutate-ring: mutate-ring-unit mutate-ring-positive mutate-ring-property

# 既知の変異を検出し、反例を縮小・再現する
counterexample:
    pnpm demo:counterexample

# 記事と同じ検証の流れを再現
experiment: check mutate-ring counterexample test-exhaustive formal-uneffect formal

# プロジェクト内に Dafny 4.11.0 を準備
setup-proof:
    pnpm proof:setup

# 実装と共有する純粋な状態遷移を証明
prove:
    pnpm proof

# コード変更を証明ファイルに反映して再検証
prove-regen:
    pnpm proof:regen

# 既知の read/write バグが証明に失敗することを確認
proof-failure:
    pnpm demo:proof-failure

# 正しい実装と既知の変異を両方検証
formal: prove proof-failure

# Uneffect で契約と副作用を検査し、JSON に証拠を保存
check-uneffect:
    pnpm check:uneffect

# Uneffect の反例を取得し、実行時にも既知のバグを再現
counterexample-uneffect:
    pnpm demo:uneffect-failure

# Uneffect の正常・異常ケースを検証
formal-uneffect: check-uneffect counterexample-uneffect

# 一通りの検証
verify: check test build mutate formal-uneffect formal
