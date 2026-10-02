# nodeproj20261002

[日本語](README.md) | English

**A TypeScript template project for experimenting with StrykerJS mutation testing.** Initialized with Vite Plus 1.0.0, it uses StrykerJS 10.0.0 and fast-check 4.10.2 to find gaps in tests, and Uneffect 0.5.1 + Z3 to check contracts and effects.

The ring buffer example follows the approach in [cargo-mutants / proptest / Kani](https://zenn.dev/mizchi/articles/rust-mutants-proptest-kani), a Japanese article.

## Use this template

Create a repository with GitHub's [Use this template](https://github.com/mizchi/nodeproj20261002/generate) button. Then update the `name` in `package.json` and the project name in both READMEs.

## Guides

The detailed guides are in Japanese:

- [Stryker and fast-check experiments](docs/fast-check-stryker.md): the reference model, generated inputs, surviving mutants, shrinking and replaying counterexamples, and exhaustive checks over a limited input space.
- [Mutation testing for Git diffs](docs/mutation-diff.md): selecting changed lines, comparing branches, when to expand the scope, and reports for diff runs.
- [Contract and effect checks with Uneffect](docs/uneffect.md): checked functions, Z3 counterexamples, the distinction between `verified` and `assumed`, and assurance boundaries.

## Reports

The commands below generate files in `reports/`. Open them locally after running the command.

| Result                                           | Report                                                                                                                                                                                                   | Command                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Mutants detected by the full test suite          | [Mutation results](reports/mutation/mutation.html)                                                                                                                                                       | `just mutate`          |
| Mutants detected in Git diffs                    | [Diff results](reports/mutation/changed.html), [selection and reasons](reports/mutation/changed-plan.json)                                                                                               | `just mutate-changed`  |
| Mutants that survive without boundary tests      | [Shipping fee demo](reports/mutation/demo.html)                                                                                                                                                          | `just mutate-demo`     |
| Unit tests compared with PBT                     | [Unit tests](reports/mutation/ring-unit.html), [PBT excluding zero lengths](reports/mutation/ring-positive.html), [PBT including zero lengths](reports/mutation/ring-property.html)                      | `just mutate-ring`     |
| Uneffect contracts, effects, and counterexamples | [Contracts](reports/uneffect/contracts.json), [effects](reports/uneffect/effects.json), [read counterexample](reports/uneffect/read-zero.json), [write counterexample](reports/uneffect/write-zero.json) | `just formal-uneffect` |

Stryker's HTML reports show each mutated expression and the tests that detected it. JSON reports with the same filenames are also generated. Reports and Stryker's working directory are excluded from Git.

## Reproduce the experiments

```sh
just install
just formal-uneffect # Check contracts and effects; obtain and reproduce known counterexamples
just experiment     # Compare mutation scores, shrink counterexamples, and check contracts
```

Unit tests detected **64/97** ring buffer mutants. PBT excluding zero lengths detected **93/97**, and PBT including zero lengths detected **97/97**. See the [experiment guide](docs/fast-check-stryker.md) for input ranges, counterexamples, exhaustive checks, and reports.

```sh
just check-uneffect          # Contracts with verified assurance; effects with declared assurance
just counterexample-uneffect # Remove the read/write zero-count guards and reproduce the bugs
```

The contract checks produced **63 verified obligations with zero assumptions**. The effect checks are **assumed, with 11 built-in contract assumptions**. JSON results are saved to `reports/uneffect/`. See the [checked functions, assurance profiles, and boundaries](docs/uneffect.md).

## Development

Use Node.js 24 or later, pnpm 10.28.2, and just.

```sh
just install # Install dependencies from the lockfile
just test    # Run unit tests with Vitest
just check   # Check formatting, lint, and types
just build   # Build the library and declarations with vp pack
just verify  # Check, test, build, run mutation tests, and check contracts and effects
```

Use `just watch` to watch tests and `just fmt` to format files. Without just, you can run `pnpm test`, `pnpm check`, and `pnpm build`.

For faster feedback on changed source, use the commands below. By default, changes to tests, configuration, or dependencies expand the scope to all source files. See [selection rules and scope](docs/mutation-diff.md).

```sh
just mutate-changed                   # Uncommitted changes relative to HEAD
just mutate-changed --base origin/main # Changes since the branch's merge-base
just mutate-changed --list             # Print the selection without running Stryker
```

The [Mutation diff](.github/workflows/mutation-diff.yml) GitHub Actions workflow checks source changes in pull requests with `--diff-only`. It skips mutation testing when there are no source changes and uploads the selection and HTML / JSON reports as an artifact. In CI, changes to tests, configuration, or dependencies do not expand the scope to all source files. See [CI behavior and manual runs](docs/mutation-diff.md#github-actions).

## Try mutation testing

`calculateShippingFee(subtotal, express?)` in `src/index.ts` charges 500 yen for regular shipping when the subtotal is below 5,000 yen, and zero otherwise. Express shipping adds 300 yen. The subtotal is expected to be a nonnegative integer in yen.

Start by running the tests without the boundary cases:

```sh
just mutate-demo
# Or: pnpm test:mutation stryker.demo.config.mjs
```

The four regular tests pass even when Stryker changes `subtotal >= 5_000` to `subtotal > 5_000`. This mutant is marked `Survived`. Six of the seven mutants are detected, giving a score of **85.71%**.

Next, include the tests for exactly 5,000 yen. This command also checks the ring buffer:

```sh
just mutate
# Or: pnpm test:mutation
```

`tests/shipping.boundary.test.ts` detects the surviving mutant, and all seven shipping fee mutants are `Killed`. Together with the 97 ring buffer mutants, the score is **100%**.

## Configuration and compatibility

- `vite.config.ts`: build, unit test, lint, and formatting settings.
- `stryker.config.json`: mutates `src/**/*.ts` and runs tests with `@stryker-mutator/vitest-runner`. Each mutant is checked by the tests that cover it.
- `stryker.demo.config.mjs`: compares the regular shipping cases. It extends the base configuration and changes the mutation targets, test files, and report paths.
- `stryker.ring.config.mjs`: compares ring buffer unit tests, PBT excluding zero lengths, and PBT including zero lengths.
- `verification/ring-contracts.ts`: calls the same scalar functions as the implementation to check read/write length changes and zero-count preservation with Uneffect.

TypeScript is pinned to **6.0.3**. With the scaffold's TypeScript 7.0.2, Stryker failed because the `parseConfigFileTextToJson` API was unavailable. Declarations are generated with `tsc`.

Uneffect uses the `--typescript-program` path for numeric contracts. The JSON report confirms that its bundled compiler and the project's TypeScript both use **6.0.3**, with **exact** compiler parity. `pnpm-workspace.yaml` contains a TypeScript peer dependency exception for Uneffect 0.5.1 on this path.

Vitest is pinned to **5.0.1**, matching Vite Plus, and `@stryker-mutator/vitest-runner` is pinned to **10.0.0**.

Vitest 5 changed the separator in full test names used by `testNamePattern` from spaces to `>`. Runner 10.0.0 supplies names separated by spaces, so tests inside `describe` blocks were not selected during mutation testing, leaving every mutant `Survived`.

`patches/@stryker-mutator__vitest-runner@10.0.0.patch` changes name construction in the runner and coverage collector to use `>`. It is registered in `pnpm-workspace.yaml` under `patchedDependencies` and applied by `just install`. This patch is for Vitest 5. When updating the runner, check whether the patch is still needed and verify that `just mutate-demo` scores 85.71% and `just mutate` scores 100%.

Official documentation: [creating a Vite Plus project](https://viteplus.dev/guide/create), [StrykerJS](https://github.com/stryker-mutator/stryker-js), [Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/), and [Vitest 5 test name changes](https://vitest.dev/guide/migration/#testnamepattern-matches-the-joined-full-name).

## License

[MIT](LICENSE). Copyright (c) 2026 mizchi.
