import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { planMutation } from "./mutation-diff.ts";
import { collectGitChanges } from "./mutation-git.ts";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      base: { type: "string" },
      list: { type: "boolean", default: false },
      "diff-only": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log("Usage: pnpm test:mutation:changed [--base <ref>] [--diff-only] [--list]");
    console.log(
      "既定: HEAD と作業ツリーの差分。--base: merge-base からの差分。--list: 対象の表示のみ。",
    );
    console.log("--diff-only: テスト・設定・依存の変更で全ソース検査へ広げない。");
    return;
  }
  const directory = process.cwd();
  const { comparison, changes } = collectGitChanges(directory, values.base);
  const plan = planMutation(changes, { diffOnly: values["diff-only"] });
  const selection = {
    base: values.base ?? "HEAD",
    comparison,
    diffOnly: values["diff-only"],
    ...plan,
    changedFiles: changes.map(({ path, status }) => ({ path, status })),
  };
  const json = `${JSON.stringify(selection, null, 2)}\n`;
  if (values.list) {
    console.log(json.trimEnd());
    return;
  }
  const reports = join(directory, "reports", "mutation");
  await mkdir(reports, { recursive: true });
  await writeFile(join(reports, "changed-plan.json"), json);
  if (plan.scope === "none") {
    console.log("変更された変異対象はありません。Stryker をスキップします。");
    return;
  }
  console.log(`Mutation scope: ${plan.scope} (${selection.base}, ${comparison})`);
  for (const reason of plan.reasons) console.log(reason);
  for (const pattern of plan.mutate) console.log(`  ${pattern}`);

  const { Stryker } = await import("@stryker-mutator/core");
  await new Stryker({
    configFile: join(directory, "stryker.config.json"),
    mutate: [...plan.mutate],
    htmlReporter: { fileName: "reports/mutation/changed.html" },
    jsonReporter: { fileName: "reports/mutation/changed.json" },
  }).runMutationTest();
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
