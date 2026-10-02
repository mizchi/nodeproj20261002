import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot, proofEnvironment } from "../scripts/dafny-toolchain.ts";

const source = await readFile(join(projectRoot, "src/ring-cursor.ts"), "utf8");
const mutations = [
  {
    name: "read の 0 件ガードを除去",
    before: "return count > 0 ? false : full;",
    after: "return false;",
  },
  {
    name: "write の 0 件ガードを除去",
    before: "return count > 0 ? front === back : full;",
    after: "return front === back;",
  },
];
const env = proofEnvironment();
await mkdir(join(projectRoot, ".tools"), { recursive: true });
const temporary = await mkdtemp(join(projectRoot, ".tools", "proof-failure-"));
try {
  // 実装・本番の証明ファイルを変更せず、契約を保った変異だけを検証する。
  await writeFile(join(temporary, "lemmascript.json"), "{}\n");
  for (const [index, mutation] of mutations.entries()) {
    assert.equal(source.split(mutation.before).length, 2, "変異箇所は 1 か所であること");
    // lsc が既存の証明を使い回さないよう、変異ごとにファイル名を変える。
    const target = join(temporary, `${index}-broken.ts`);
    await writeFile(target, source.replace(mutation.before, mutation.after));
    const result = spawnSync(
      join(projectRoot, "node_modules", ".bin", "lsc"),
      ["check", "--backend=dafny", target],
      { cwd: temporary, env, encoding: "utf8" },
    );
    if (result.error) throw result.error;
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, `${mutation.name}: 証明が失敗するはず\n${output}`);
    assert.match(output, /a postcondition could not be proved/, "契約違反による失敗であること");
    console.log(`${mutation.name}: 契約違反を検出`);
    console.log(output);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
