import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

export const dafnyVersion = "4.11.0";
export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export const dafnyDirectory = join(projectRoot, ".tools", `dafny-${dafnyVersion}`, "dafny");

/** プロジェクト内の Dafny を優先し、同じバージョンの PATH 上のものも使える。 */
export function proofEnvironment(): NodeJS.ProcessEnv {
  const env = {
    ...process.env,
    PATH: `${dafnyDirectory}${delimiter}${process.env.PATH ?? ""}`,
  };
  const result = spawnSync("dafny", ["--version"], { env, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error("Dafny がありません。just setup-proof を実行してください。", {
      cause: result.error,
    });
  }
  if (result.stdout.trim().split("+")[0] !== dafnyVersion) {
    throw new Error(`Dafny ${dafnyVersion} が必要です。just setup-proof を実行してください。`);
  }
  return env;
}

export function hasLocalDafny(): boolean {
  return existsSync(join(dafnyDirectory, "dafny"));
}
