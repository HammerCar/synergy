import { relations, sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  int,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

import { mySqlTable } from "./_table";

export const standupProgresses = mySqlTable("standup_progress", {
  id: varchar("id", { length: 24 }).primaryKey(),

  userId: varchar("user_id", { length: 24 }).notNull().unique(),
  currentQuestionId: varchar("current_question_id", { length: 256 }).notNull(),
  currentStandupId: varchar("standup_id", { length: 24 }).notNull(),

  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const standupProgressesRelations = relations(
  standupProgresses,
  ({ one }) => ({
    question: one(questions, {
      fields: [standupProgresses.currentQuestionId],
      references: [questions.id],
    }),
  }),
);

export const questions = mySqlTable("question", {
  id: varchar("id", { length: 24 }).primaryKey(),

  serverId: varchar("server_id", { length: 24 }).notNull(),
  question: varchar("question", { length: 256 }).notNull(),
  private: boolean("private").notNull().default(false),

  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const questionsRelations = relations(questions, ({ many }) => ({
  standups: many(standupProgresses),
  answers: many(answers),
  questionsToStandups: many(questionsToStandups),
}));

export const standupTemplates = mySqlTable(
  "standup_template",
  {
    id: varchar("id", { length: 24 }).primaryKey(),

    serverId: varchar("server_id", { length: 24 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    resultChannelId: varchar("result_channel_id", { length: 24 }).notNull(),

    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (t) => ({
    unq: unique().on(t.serverId, t.name),
  }),
);

export const standupTemplatesRelations = relations(
  standupTemplates,
  ({ many }) => ({
    questionsToStandupTemplates: many(questionsToStandupTemplates),
  }),
);

export const standups = mySqlTable("standup", {
  id: varchar("id", { length: 24 }).primaryKey(),

  serverId: varchar("server_id", { length: 24 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  date: datetime("date").notNull(),
  resultChannelId: varchar("result_channel_id", { length: 24 }).notNull(),

  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const standupsRelations = relations(standups, ({ many }) => ({
  questionsToStandups: many(questionsToStandups),
}));

export const questionsToStandupTemplates = mySqlTable(
  "questions_to_standup_templates",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    questionId: varchar("question_id", { length: 24 }).notNull(),
    standupTemplateId: varchar("standup_template_id", { length: 24 }).notNull(),
    order: int("order").notNull(),
  },
);

export const questionsToStandupTemplatesRelations = relations(
  questionsToStandupTemplates,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionsToStandupTemplates.questionId],
      references: [questions.id],
    }),
    standups: one(standupTemplates, {
      fields: [questionsToStandupTemplates.standupTemplateId],
      references: [standupTemplates.id],
    }),
  }),
);

export const questionsToStandups = mySqlTable("questions_to_standups", {
  id: varchar("id", { length: 24 }).primaryKey(),
  questionId: varchar("question_id", { length: 24 }).notNull(),
  standupId: varchar("standup_id", { length: 24 }).notNull(),
  order: int("order").notNull(),
});

export const questionsToStandupsRelations = relations(
  questionsToStandups,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionsToStandups.questionId],
      references: [questions.id],
    }),
    standups: one(standupTemplates, {
      fields: [questionsToStandups.standupId],
      references: [standupTemplates.id],
    }),
  }),
);

export const answers = mySqlTable("answers", {
  id: varchar("id", { length: 24 }).primaryKey(),

  userId: varchar("user_id", { length: 24 }).notNull(),
  questionToStandupId: varchar("question_to_standup_id", {
    length: 24,
  }).notNull(),
  answer: varchar("answer", { length: 1024 }).notNull(),

  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const answersRelations = relations(answers, ({ one }) => ({
  questionToStandup: one(questions, {
    fields: [answers.questionToStandupId],
    references: [questions.id],
  }),
}));
