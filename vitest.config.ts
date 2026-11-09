import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // アプリと同じ「@/」の書き方で読めるようにする(tsconfig の paths と同じ)
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
