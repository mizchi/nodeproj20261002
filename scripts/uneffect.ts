import assert from "node:assert/strict";
import { runUneffect, saveReport } from "./uneffect-toolchain.ts";

const contracts = runUneffect(["src/ring-cursor.ts", "verification/ring-contracts.ts"], "verified");
const contractReport = await saveReport("contracts", contracts.report);
assert.equal(contracts.exitCode, 0, `契約の検証失敗: ${contractReport}`);
assert.equal(contracts.decision.outcome, "passed");
assert.equal(contracts.decision.profile, "verified");
assert.equal(contracts.decision.status, "verified");
assert.equal(contracts.decision.passed, true);
assert.equal(contracts.decision.assumptions, 0);
assert.equal(contracts.decision.compilerParity, "exact");
assert.ok(contracts.decision.contracts.every((artifact) => artifact.status === "verified"));
// コメントを消して検証件数が 0 になっても、成功として扱わない。
for (const name of [
  "lengthValue",
  "advanceIndex",
  "fullAfterRead",
  "fullAfterWrite",
  "readContract",
  "writeContract",
]) {
  assert.ok(
    contracts.decision.contracts.some((artifact) => artifact.functionName === name),
    `${name} の検証結果が必要`,
  );
}
console.log(
  `Uneffect contracts: verified (${contracts.decision.contracts.length} obligations, 0 assumptions)`,
);

// Uint8Array / Number の組み込み契約を使う境界は、その仮定を記録した declared 検査。
const effects = runUneffect(["src/ring-buffer.ts"], "declared");
const effectReport = await saveReport("effects", effects.report);
assert.equal(effects.exitCode, 0, `副作用の検査失敗: ${effectReport}`);
assert.equal(effects.decision.outcome, "passed");
assert.equal(effects.decision.profile, "declared");
assert.equal(effects.decision.passed, true);
assert.ok(["verified", "assumed"].includes(effects.decision.status));
assert.equal(effects.decision.compilerParity, "exact");
console.log(
  `Uneffect effects: ${effects.decision.status} (${effects.decision.assumptions} builtin assumptions)`,
);
console.log(`Reports: ${contractReport}, ${effectReport}`);
