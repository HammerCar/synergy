import { relations, sql } from "drizzle-orm";
import {
  boolean,
  int,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

import { mySqlTable } from "./_table";

export const standups = mySqlTable("standup", {
  id: varchar("id", { length: 24 }).primaryKey(),

  serverId: varchar("server_id", { length: 24 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  resultChannelId: varchar("result_channel_id", { length: 24 }).notNull(),
  isTemplate: boolean("is_template").notNull().default(false),

  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const standupsRelations = relations(standups, ({ many }) => ({
  questions: many(questions),
}));

export const questions = mySqlTable("question", {
  id: varchar("id", { length: 24 }).primaryKey(),

  standupId: varchar("standup_id", { length: 24 }).notNull(),
  order: int("order").notNull(),

  question: varchar("question", { length: 256 }).notNull(),
  private: boolean("private").notNull().default(false),

  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const questionsRelations = relations(questions, ({ one, many }) => ({
  standup: one(standups, {
    fields: [questions.standupId],
    references: [standups.id],
  }),
  answers: many(answers),
}));

export const answers = mySqlTable(
  "answers",
  {
    id: varchar("id", { length: 24 }).primaryKey(),

    userId: varchar("user_id", { length: 24 }).notNull(),
    questionId: varchar("question_id", {
      length: 24,
    }).notNull(),
    answer: varchar("answer", { length: 1024 }).notNull(),

    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
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
