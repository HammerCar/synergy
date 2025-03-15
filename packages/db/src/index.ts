import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as activity from "./schema/activity";
import * as standup from "./schema/standup";

export const schema = { ...standup, ...activity };

export { sqliteTable as tableCreator } from "./schema/_table";

export * from "drizzle-orm";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
