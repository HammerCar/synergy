import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

export default {
  schema: "./src/schema",
  out: "./drizzle/migrations",
  driver: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  tablesFilter: ["synergy_*"],
} satisfies Config;
