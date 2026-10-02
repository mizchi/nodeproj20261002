import { expect, test } from "vitest";
import { planMutation, type FileChange } from "../scripts/mutation-diff.ts";

const modified = (path: string, patch: string): FileChange => ({ path, status: "modified", patch });

test("離れた変更 hunk は新しいソースの行番号で指定する", () => {
  const plan = planMutation([
    modified("src/index.ts", "@@ -3 +3 @@\n-old\n+new\n@@ -8,0 +9,2 @@\n+first\n+second\n"),
  ]);
  expect(plan.scope).toBe("changed");
  expect(plan.mutate).toEqual(["src/index.ts:3-3", "src/index.ts:9-10"]);
});

test("削除で行数が減る hunk は残ったファイル全体を検査する", () => {
  const plan = planMutation([modified("src/index.ts", "@@ -3,2 +2,0 @@\n-first\n-second\n")]);
  expect(plan.mutate).toEqual(["src/index.ts"]);
});

test("複数の hunk の一つで行数が減った場合もファイル全体を検査する", () => {
  const plan = planMutation([
    modified("src/index.ts", "@@ -3 +3 @@\n-old\n+new\n@@ -8,2 +8 @@\n-a\n-b\n+c\n"),
  ]);
  expect(plan.mutate).toEqual(["src/index.ts"]);
});

test("追加したソースは全体を検査し、削除したファイルは変異させない", () => {
  const plan = planMutation([
    { path: "src/new.ts", status: "added", patch: "" },
    { path: "src/old.ts", status: "deleted", patch: "" },
  ]);
  expect(plan.mutate).toEqual(["src/new.ts"]);
});

test("ドキュメントだけの変更と差分なしでは Stryker を起動しない", () => {
  for (const changes of [[], [modified("docs/guide.md", "@@ -1 +1 @@\n-old\n+new\n")]]) {
    expect(planMutation(changes).scope).toBe("none");
    expect(planMutation(changes).mutate).toEqual([]);
  }
});

test("テスト・参照モデル・設定・依存の変更では全ソースを検査する", () => {
  for (const path of [
    "tests/shipping.test.ts",
    "tests/support/ring-model.ts",
    "vite.config.ts",
    "stryker.config.json",
    "pnpm-lock.yaml",
    "package.json",
  ]) {
    const plan = planMutation([modified(path, "")]);
    expect(plan.scope, path).toBe("all");
    expect(plan.mutate, path).toEqual(["src/**/*.ts"]);
    expect(plan.reasons.join(" "), path).toContain(path);
  }
});

test("CI の diff-only はテストや依存の変更があっても変更行だけを選ぶ", () => {
  const plan = planMutation(
    [
      modified("src/index.ts", "@@ -3 +3 @@\n-old\n+new\n"),
      modified("tests/shipping.test.ts", ""),
      modified("pnpm-lock.yaml", ""),
    ],
    { diffOnly: true },
  );
  expect(plan.scope).toBe("changed");
  expect(plan.mutate).toEqual(["src/index.ts:3-3"]);
});

test("CI の diff-only はソース差分がない場合に全体検査へ広げない", () => {
  const plan = planMutation(
    [modified("tests/support/ring-model.ts", ""), modified("package.json", "")],
    { diffOnly: true },
  );
  expect(plan.scope).toBe("none");
  expect(plan.mutate).toEqual([]);
});

test("行 hunk がないソースの変更は黙ってスキップしない", () => {
  expect(
    planMutation([modified("src/index.ts", "old mode 100644\nnew mode 100755")]).mutate,
  ).toEqual(["src/index.ts"]);
});

test("空白・日本語・カンマのあるパスを一つの対象として扱う", () => {
  expect(planMutation([modified("src/送料, fee.ts", "@@ -3 +3 @@\n-old\n+new\n")]).mutate).toEqual([
    "src/送料, fee.ts:3-3",
  ]);
});

test("Stryker が glob と解釈するパスは他のファイルを選択せずエラーにする", () => {
  expect(() => planMutation([modified("src/item[1].ts", "@@ -3 +3 @@\n-old\n+new\n")])).toThrow(
    /glob/,
  );
});
