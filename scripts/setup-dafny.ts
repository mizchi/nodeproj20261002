import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  dafnyDirectory,
  dafnyVersion,
  hasLocalDafny,
  proofEnvironment,
} from "./dafny-toolchain.ts";

// Dafny 4.11.0 公式 release のアーカイブと SHA-256。
const archives: Record<string, readonly [string, string]> = {
  "darwin-arm64": [
    "arm64-macos-13",
    "c90c75e7d5db9c6ccbb7127840dfe43f0ac938b039a7ebed146d8ead383a572f",
  ],
  "darwin-x64": [
    "x64-macos-13",
    "5fc0de946c5b2fad33f16bd22a5b06f4fd0dfa7f6d770284237e3f1f3ca9f73d",
  ],
  "linux-x64": [
    "x64-ubuntu-22.04",
    "a46a9ff7cdd720f7955854c78e95df13f4cfe6b80691b05f8654fe19e8267179",
  ],
};

if (!hasLocalDafny()) {
  const archive = archives[`${process.platform}-${process.arch}`];
  if (!archive) throw new Error("この環境では Dafny 4.11.0 を PATH に用意してください。");
  const [suffix, digest] = archive;
  const url = `https://github.com/dafny-lang/dafny/releases/download/v${dafnyVersion}/dafny-${dafnyVersion}-${suffix}.zip`;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Dafny download: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== digest) {
    throw new Error("Dafny アーカイブの SHA-256 が一致しません。");
  }
  const temporary = await mkdtemp(join(tmpdir(), "ring-dafny-"));
  try {
    const zip = join(temporary, "dafny.zip");
    await writeFile(zip, bytes);
    await mkdir(dirname(dafnyDirectory), { recursive: true });
    const result = spawnSync("unzip", ["-q", zip, "-d", dirname(dafnyDirectory)], {
      stdio: "inherit",
    });
    if (result.error || result.status !== 0) throw new Error("Dafny の展開に失敗しました。");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
proofEnvironment();
console.log(`Dafny ${dafnyVersion}: ready`);
