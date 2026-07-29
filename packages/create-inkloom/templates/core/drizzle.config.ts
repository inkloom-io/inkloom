import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
  strict: true,
  verbose: true,
});
