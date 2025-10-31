import { defineConfig } from "rollup";

export default defineConfig({
  input: "src/index.js",
  output: [
    {
      file: "dist/index.js",
      format: "cjs",
      sourcemap: true,
    },
    {
      file: "dist/index.mjs",
      format: "es",
      sourcemap: true,
    },
  ],
  external: [
    "@langchain/core",
    "@langchain/google-genai",
    "@langchain/openai",
    "@langchain/community",
    "@google/generative-ai",
    "better-sqlite3",
    "cors",
    "ethers",
    "express",
    "express-rate-limit",
    "helmet",
    "langchain",
    "node-fetch",
    "viem",
    "ws",
    "zod",
  ],
});
