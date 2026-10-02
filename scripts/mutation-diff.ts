import { matchesGlob } from "node:path";
import config from "../stryker.config.json" with { type: "json" };

export interface FileChange {
  readonly path: string;
  readonly status: "added" | "modified" | "deleted";
  readonly patch: string;
}

export interface MutationPlan {
  readonly scope: "changed" | "all" | "none";
  readonly mutate: readonly string[];
  readonly reasons: readonly string[];
}

export interface MutationPlanOptions {
  readonly diffOnly?: boolean;
}

const validationFiles = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "vite.config.ts",
]);

export function isMutationSource(path: string): boolean {
  return config.mutate.some((pattern) => matchesGlob(path, pattern));
}

/** Git の新しい行番号を Stryker の 1-based・両端を含む範囲へ変換する。 */
export function planMutation(
  changes: readonly FileChange[],
  options: MutationPlanOptions = {},
): MutationPlan {
  const validationChanges = changes.filter(
    ({ path }) =>
      path.startsWith("tests/") ||
      validationFiles.has(path) ||
      /^stryker\..*\.(?:json|mjs)$/.test(path),
  );
  if (!options.diffOnly && validationChanges.length > 0) {
    return {
      scope: "all",
      mutate: [...config.mutate],
      reasons: validationChanges.map(
        ({ path }) => `${path}: テスト・設定・依存の変更につき全体を検査`,
      ),
    };
  }

  const mutate: string[] = [];
  const reasons: string[] = [];
  for (const change of changes) {
    if (change.status === "deleted" || !isMutationSource(change.path)) continue;
    // Stryker は範囲と glob の併用を拒否し、バックスラッシュを区切りに変換する。
    if (/[*?[\]{}()!\\\r\n]/.test(change.path)) {
      throw new Error(`Stryker の glob と区別できないパスです: ${change.path}`);
    }
    const hunks = [...change.patch.matchAll(/^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)];
    const shrinks = hunks.some((match) => Number(match[1] ?? 1) > Number(match[3] ?? 1));
    if (change.status === "added" || shrinks || hunks.length === 0) {
      mutate.push(change.path);
      reasons.push(`${change.path}: 追加・行数減少・行範囲なしにつきファイル全体を検査`);
      continue;
    }
    for (const match of hunks) {
      const start = Number(match[2]);
      const count = Number(match[3] ?? 1);
      if (count > 0) mutate.push(`${change.path}:${start}-${start + count - 1}`);
    }
  }
  return { scope: mutate.length === 0 ? "none" : "changed", mutate, reasons };
}
