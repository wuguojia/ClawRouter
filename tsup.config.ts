import { builtinModules } from "node:module";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/proxy-simple.ts", "src/cli-simple.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  splitting: false,
  noExternal: [/.*/],
  external: [...builtinModules.flatMap((m) => [m, `node:${m}`])],
  banner: {
    js: `#!/usr/bin/env node\nimport { createRequire as __cjs_createRequire } from 'node:module'; const require = __cjs_createRequire(import.meta.url);`,
  },
});
