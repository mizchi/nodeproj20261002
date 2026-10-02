import config from "./stryker.config.json" with { type: "json" };

const suites = new Map([
  ["unit", ["tests/ring-buffer.unit.test.ts"]],
  ["positive", ["tests/ring-buffer.unit.test.ts", "tests/ring-buffer.positive.property.test.ts"]],
  ["property", ["tests/ring-buffer.unit.test.ts", "tests/ring-buffer.property.test.ts"]],
]);
const suite = process.env.RING_TEST_SUITE ?? "property";
const testFiles = suites.get(suite);
if (!testFiles) throw new Error(`Unknown RING_TEST_SUITE: ${suite}`);

export default {
  ...config,
  mutate: ["src/ring-buffer.ts", "src/ring-cursor.ts"],
  testFiles,
  clearTextReporter: { reportTests: false, reportMutants: false },
  htmlReporter: { fileName: `reports/mutation/ring-${suite}.html` },
  jsonReporter: { fileName: `reports/mutation/ring-${suite}.json` },
};
