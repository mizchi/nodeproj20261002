import { execFileSync } from "node:child_process";
import { isMutationSource, type FileChange } from "./mutation-diff.ts";

export interface GitChanges {
  readonly comparison: string;
  readonly changes: readonly FileChange[];
}

/** Git を読み取り専用で呼び出す。ユーザーの ref やパスをシェルに渡さない。 */
export function collectGitChanges(directory: string, base?: string): GitChanges {
  function git(...args: string[]): string {
    try {
      return execFileSync("git", ["-C", directory, ...args], {
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch (cause) {
      throw new Error(
        `git ${args.join(" ")} に失敗しました。比較先とリポジトリを確認してください。`,
        {
          cause,
        },
      );
    }
  }

  const commit = git(
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${base ?? "HEAD"}^{commit}`,
  ).trim();
  const comparison = base === undefined ? commit : git("merge-base", "HEAD", commit).trim();
  const diffOptions = ["--no-renames", "--no-ext-diff", "--no-textconv"];
  const entries = git("diff", "--name-status", "-z", ...diffOptions, comparison, "--")
    .split("\0")
    .filter(Boolean);
  const changes: FileChange[] = [];
  for (let index = 0; index < entries.length; index += 2) {
    const [status, path] = entries.slice(index, index + 2);
    if (!path || !["A", "M", "D", "T"].includes(status)) {
      throw new Error(
        `git diff の状態を扱えません: ${status} ${path ?? ""}。競合を解消してください。`,
      );
    }
    changes.push({
      path,
      status: status === "A" ? "added" : status === "D" ? "deleted" : "modified",
      patch:
        ["M", "T"].includes(status) && isMutationSource(path)
          ? git(
              "diff",
              "--unified=0",
              "--no-color",
              ...diffOptions,
              comparison,
              "--",
              `:(literal)${path}`,
            )
          : "",
    });
  }
  for (const path of git("ls-files", "--others", "--exclude-standard", "-z").split("\0")) {
    if (path) changes.push({ path, status: "added", patch: "" });
  }
  changes.sort((first, second) => first.path.localeCompare(second.path));
  return { comparison, changes };
}
