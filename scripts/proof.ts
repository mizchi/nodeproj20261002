import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { projectRoot, proofEnvironment } from "./dafny-toolchain.ts";

const result = spawnSync(
  join(projectRoot, "node_modules", ".bin", "lsc"),
  [process.argv[2] ?? "check", "--backend=dafny", ...process.argv.slice(3)],
  { cwd: projectRoot, env: proofEnvironment(), stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
