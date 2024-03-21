import { relations, sql } from "drizzle-orm";
import { integer, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteTable } from "./_table";

export const standups = sqliteTable("standup", {
  id: text("id", { length: 24 }).primaryKey(),

  serverId: text("server_id", { length: 24 }).notNull(),
  name: text("name", { length: 256 }).notNull(),
  resultChannelId: text("result_channel_id", { length: 24 }).notNull(),
  isTemplate: integer("is_template", { mode: "boolean" })
    .notNull()
    .default(false),

  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const standupsRelations = relations(standups, ({ many }) => ({
  questions: many(questions),
}));

export const questions = sqliteTable("question", {
  id: text("id", { length: 24 }).primaryKey(),

  standupId: text("standup_id", { length: 24 }).notNull(),
  order: integer("order").notNull(),

  question: text("question", { length: 256 }).notNull(),
  private: integer("private", { mode: "boolean" }).notNull().default(false),

  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const questionsRelations = relations(questions, ({ one, many }) => ({
  standup: one(standups, {
    fields: [questions.standupId],
    references: [standups.id],
  }),
  answers: many(answers),
}));

export const answers = sqliteTable(
  "answers",
  {
    id: text("id", { length: 24 }).primaryKey(),

    userId: text("user_id", { length: 24 }).notNull(),
    questionId: text("question_id", {
      length: 24,
    }).notNull(),
    answer: text("answer", { length: 1024 }).notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    unq: unique().on(t.userId, t.questionId),
  }),
);

export const answersRelations = relations(answers, ({ one }) => ({
  question: one(questions, {
    fields: [answers.questionId],
    references: [questions.id],
  }),
}));
