import { defineConfig } from "@playwright/test";

// De site draait als Cloudflare Worker; `npm run dev` start wrangler op 8788.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.QA_BASE_URL || "http://localhost:8788",
  },
});
