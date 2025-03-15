import { sql } from "drizzle-orm";
import { integer, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteTable } from "./_table";

export const activities = sqliteTable(
  "activity",
  {
    id: text("id", { length: 24 }).primaryKey(),

    userId: text("user_id", { length: 24 }).notNull(),
    serverId: text("server_id", { length: 24 }).notNull(),
    date: text("date", { length: 10 }).notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    unq: unique().on(t.userId, t.serverId, t.date),
  }),
);
