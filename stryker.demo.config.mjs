import config from "./stryker.config.json" with { type: "json" };

export default {
  ...config,
  mutate: ["src/index.ts"],
  testFiles: ["tests/shipping.test.ts"],
  htmlReporter: {
    fileName: "reports/mutation/demo.html",
  },
  jsonReporter: {
    fileName: "reports/mutation/demo.json",
  },
};
