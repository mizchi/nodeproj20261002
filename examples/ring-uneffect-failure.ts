import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot, runUneffect, saveReport } from "../scripts/uneffect-toolchain.ts";

const source = await readFile(join(projectRoot, "src/ring-cursor.ts"), "utf8");
const mutations = [
  {
    name: "read-zero",
    functionName: "fullAfterRead",
    before: "return count > 0 ? false : full;",
    after: "return false;",
  },
  {
    name: "write-zero",
    functionName: "fullAfterWrite",
    before: "return count > 0 ? front === back : full;",
    after: "return front === back;",
  },
];
await mkdir(join(projectRoot, ".tools"), { recursive: true });
const temporary = await mkdtemp(join(projectRoot, ".tools", "uneffect-failure-"));
try {
  for (const mutation of mutations) {
    assert.equal(source.split(mutation.before).length, 2, "変異箇所は 1 か所であること");
    const file = join(temporary, `${mutation.name}.ts`);
    await writeFile(file, source.replace(mutation.before, mutation.after));
    const result = runUneffect([file], "verified");
    const report = await saveReport(mutation.name, result.report);
    assert.equal(result.exitCode, 1, `変異の検出失敗: ${report}`);
    assert.equal(result.decision.outcome, "failed");
    assert.equal(result.decision.status, "violated");
    const counterexample = result.decision.contracts.find(
      (artifact) =>
        artifact.status === "counterexample" && artifact.functionName === mutation.functionName,
    );
    assert.ok(counterexample, "unsupported や unknown ではなく、契約の反例を得ること");
    assert.equal(counterexample.assignments.count, "0");

    // 一時コピーを実行し、容量 1 の実際のカーソル更新でも同じバグを再現する。
    const broken: typeof import("../src/ring-cursor.ts") = await import(pathToFileURL(file).href);
    if (mutation.name === "read-zero") {
      const next = broken.commitRead(1, { front: 0, back: 0, full: true }, 0);
      assert.equal(broken.cursorLength(1, next), 0);
    } else {
      const next = broken.commitWrite(1, { front: 0, back: 0, full: false }, 0);
      assert.equal(broken.cursorLength(1, next), 1);
    }
    console.log(`${mutation.name}: violated, runtime replay PASS`);
    console.log(`Z3 counterexample: ${JSON.stringify(counterexample.assignments)}`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
