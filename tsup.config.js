// @ts-nocheck
import {defineConfig} from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  outExtension({format}) {
    return {
      js: format === "cjs" ? ".cjs" : ".mjs",
    };
  },
});
