import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test } from "vitest";
import { collectGitChanges } from "../scripts/mutation-git.ts";
import { planMutation } from "../scripts/mutation-diff.ts";

let directory: string;

function git(...args: string[]): string {
  return execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
}

function write(path: string, source: string): void {
  writeFileSync(join(directory, path), source);
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "stryker-diff-test-"));
  git("init", "--initial-branch=main");
  git("config", "user.name", "Mutation test fixture");
  git("config", "user.email", "fixture@example.invalid");
  mkdirSync(join(directory, "src"));
  write(
    "src/index.ts",
    "export const first = 1;\nexport const second = 2;\nexport const third = 3;\n",
  );
  write(".gitignore", "ignored.ts\n");
  git("add", ".");
  git("commit", "-m", "fixture");
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

test("HEAD 比較に staged と unstaged の両方を含める", () => {
  write(
    "src/index.ts",
    "export const first = 10;\nexport const second = 2;\nexport const third = 3;\n",
  );
  git("add", "src/index.ts");
  write(
    "src/index.ts",
    "export const first = 10;\nexport const second = 2;\nexport const third = 30;\n",
  );
  const result = collectGitChanges(directory);
  expect(planMutation(result.changes).mutate).toEqual(["src/index.ts:1-1", "src/index.ts:3-3"]);
  expect(result.comparison).toBe(git("rev-parse", "HEAD"));
});

test("未追跡のソースを含め、gitignore の対象は除く", () => {
  write("src/送料, fee.ts", "export const fee = 500;\n");
  write("src/ignored.ts", "export const ignored = 1;\n");
  const result = collectGitChanges(directory);
  expect(planMutation(result.changes).mutate).toEqual(["src/送料, fee.ts"]);
});

test("ブランチ比較は merge-base を使い、比較先だけの変更を含めない", () => {
  git("checkout", "-b", "feature");
  write(
    "src/index.ts",
    "export const first = 10;\nexport const second = 2;\nexport const third = 3;\n",
  );
  git("commit", "-am", "feature change");
  git("checkout", "main");
  write("src/main-only.ts", "export const unrelated = true;\n");
  git("add", ".");
  git("commit", "-m", "main change");
  git("checkout", "feature");
  write("src/local.ts", "export const local = 1;\n");
  const result = collectGitChanges(directory, "main");
  expect(result.comparison).toBe(git("merge-base", "HEAD", "main"));
  expect(planMutation(result.changes).mutate).toEqual(["src/index.ts:1-1", "src/local.ts"]);
});

test("rename は削除と追加として扱い、新しいパスの全体を検査する", () => {
  git("mv", "src/index.ts", "src/renamed.ts");
  expect(planMutation(collectGitChanges(directory).changes).mutate).toEqual(["src/renamed.ts"]);
});

test("存在しない比較先を差分なしとして扱わない", () => {
  expect(() => collectGitChanges(directory, "missing-base")).toThrow(/git/);
});

test("クリーンな作業ツリーでは差分なしになる", () => {
  expect(collectGitChanges(directory).changes).toEqual([]);
});

test("--list は計画だけを出力し、作業ツリーやレポートを変更しない", () => {
  write("src/new.ts", "export const added = 1;\n");
  const before = git("status", "--porcelain");
  const script = fileURLToPath(new URL("../scripts/mutation-changed.ts", import.meta.url));
  const output = execFileSync(process.execPath, [script, "--list"], {
    cwd: directory,
    encoding: "utf8",
    stdio: "pipe",
  });
  expect(JSON.parse(output)).toMatchObject({ scope: "changed", mutate: ["src/new.ts"] });
  expect(git("status", "--porcelain")).toBe(before);
  expect(existsSync(join(directory, "reports"))).toBe(false);
});

test("CLI の不正な引数は成功終了しない", () => {
  const script = fileURLToPath(new URL("../scripts/mutation-changed.ts", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--unknown"], {
    cwd: directory,
    encoding: "utf8",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Unknown option");
});

test("CLI の --diff-only は設定変更とソース変更の混在時も変更行に絞る", () => {
  write(
    "src/index.ts",
    "export const first = 10;\nexport const second = 2;\nexport const third = 3;\n",
  );
  write("package.json", JSON.stringify({ private: true }));
  const script = fileURLToPath(new URL("../scripts/mutation-changed.ts", import.meta.url));
  const output = execFileSync(process.execPath, [script, "--diff-only", "--list"], {
    cwd: directory,
    encoding: "utf8",
    stdio: "pipe",
  });
  expect(JSON.parse(output)).toMatchObject({
    diffOnly: true,
    scope: "changed",
    mutate: ["src/index.ts:1-1"],
  });
});
