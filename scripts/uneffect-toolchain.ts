import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));

interface ContractResult {
  status: string;
  functionName: string;
  assignments: Readonly<Record<string, string>>;
}

interface Decision {
  outcome: string;
  profile: string;
  status: string;
  passed: boolean;
  contracts: readonly ContractResult[];
  assumptions: number;
  compilerParity: string;
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  assert.equal(typeof value, "string");
  return value as string;
}

function array(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));
  return value;
}

function readDecision(value: unknown): Decision {
  const report = record(value);
  assert.equal(report.schema, "uneffect-check/v1");
  const assurance = record(report.assurance);
  assert.equal(typeof assurance.passed, "boolean");
  const assumptions = record(report.assumptions);
  assert.equal(array(assumptions.violations).length, 0, "仮定の台帳に違反がないこと");
  const compiler = record(record(report.project).compiler);
  return {
    outcome: string(report.outcome),
    profile: string(assurance.profile),
    status: string(assurance.status),
    passed: assurance.passed as boolean,
    assumptions: array(assumptions.entries).length,
    compilerParity: string(compiler.parity),
    contracts: array(report.contracts).map((value) => {
      const artifact = record(value);
      const assignments: Record<string, string> = {};
      if (artifact.counterexample !== undefined) {
        for (const [name, value] of Object.entries(
          record(record(artifact.counterexample).assignments),
        )) {
          assignments[name] = string(value);
        }
      }
      return {
        status: string(artifact.status),
        functionName:
          artifact.obligation === undefined ? "" : string(record(artifact.obligation).functionName),
        assignments,
      };
    }),
  };
}

/** CLI の終了状態と検証結果を保持し、未対応と反例を混同しない。 */
export function runUneffect(files: readonly string[], profile: "verified" | "declared") {
  const result = spawnSync(
    join(projectRoot, "node_modules", ".bin", "uneffect"),
    [
      "check",
      "--typescript-program",
      "--project",
      join(projectRoot, "tsconfig.json"),
      "--assurance",
      profile,
      "--json",
      ...files,
    ],
    { cwd: projectRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (!result.stdout.trim())
    throw new Error(`Uneffect が JSON を返しませんでした: ${result.stderr}`);
  const report: unknown = JSON.parse(result.stdout);
  return { exitCode: result.status, report, decision: readDecision(report) };
}

export async function saveReport(name: string, report: unknown): Promise<string> {
  const directory = join(projectRoot, "reports", "uneffect");
  await mkdir(directory, { recursive: true });
  const file = join(directory, `${name}.json`);
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
