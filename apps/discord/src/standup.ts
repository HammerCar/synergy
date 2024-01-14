import type { Message, User } from "discord.js";
import cuid2 from "@paralleldrive/cuid2";

import { and, db, eq, schema } from "@acme/db";

import client from "./bot";

const startMessage = "Standup time!";
//const questions = [
//  "What went well?",
//  "What didn't go well?",
//  "What should we do differently next time?",
//];
const endMessage = "Standup over!";

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// TODO: Add support for multiple standups
const startStandup = async () => {
  console.log("Starting standup...");

  const guild = await client.guilds.fetch(process.env.GUILD_ID ?? "");
  await guild.members.fetch();

  const role = await guild.roles.fetch(process.env.STANDUP_ROLE_ID ?? "");
  const members = role?.members.map((member) => member.user);

  const standupTemplate = await db.query.standupTemplates.findFirst({
    columns: {
      name: true,
      resultChannelId: true,
      serverId: true,
    },
    where: eq(schema.standups.serverId, process.env.GUILD_ID ?? ""),
    with: {
      questionsToStandupTemplates: {
        with: {
          question: {
            columns: {
              id: true,
              question: true,
            },
          },
        },
      },
    },
  });

  if (!standupTemplate) {
    console.error("No standup template found!");
    return;
  }

  const questionsToStandupTemplate =
    standupTemplate.questionsToStandupTemplates[0];
  if (!questionsToStandupTemplate) {
    console.error("No questions found!");
    return;
  }

  const standupId = cuid2.createId();
  await db.insert(schema.standups).values({
    id: standupId,
    name: standupTemplate.name,
    date: new Date(),
    resultChannelId: standupTemplate.resultChannelId,
    serverId: standupTemplate.serverId,
  });

  for (const question of standupTemplate.questionsToStandupTemplates) {
    await db.insert(schema.questionsToStandups).values({
      id: cuid2.createId(),
      questionId: question.question.id,
      standupId,
      order: question.order,
    });
  }

  const question = questionsToStandupTemplate.question;
  const questionId = question.id;
  const questionString = question.question;

  const promises = members?.map(async (member) => {
    if (member) {
      const dmChannel = await member.createDM();
      await dmChannel.send(startMessage);

      await sendQuestion(member, questionId, standupId, questionString);
    }
  });

  const res = await Promise.allSettled(promises ?? []);
  console.log(res);
};

const sendQuestion = async (
  user: User,
  questionId: string,
  standupId: string,
  question: string,
) => {
  const dmChannel = await user.createDM();

  await db
    .insert(schema.standupProgresses)
    .values({
      id: cuid2.createId(),
      userId: user.id,
      currentQuestionId: questionId,
      currentStandupId: standupId,
    })
    .onDuplicateKeyUpdate({
      set: {
        currentQuestionId: questionId,
      },
    })
    .execute();

  await dmChannel.sendTyping();
  await sleep(500);

  await dmChannel.send(question);
};

const onDirectMessage = async (message: Message) => {
  const user = message.author;
  const answer = message.content;

  const standupProgress = await db.query.standupProgresses.findFirst({
    columns: {
      currentQuestionId: true,
      currentStandupId: true,
    },
    where: eq(schema.standupProgresses.userId, user.id),
  });

  const lastQuestionId = standupProgress?.currentQuestionId;
  const currentStandupId = standupProgress?.currentStandupId;

  if (!lastQuestionId || !currentStandupId) {
    await message.channel.send("Standup hasn't started yet!");
    return;
  }

  const questionToStandup = await db.query.questionsToStandups.findFirst({
    columns: {
      id: true,
    },
    where: and(
      eq(schema.questionsToStandups.questionId, lastQuestionId),
      eq(schema.questionsToStandups.standupId, currentStandupId),
    ),
  });

  if (!questionToStandup) {
    console.error("No question found!");
    return;
  }

  await db.insert(schema.answers).values({
    id: cuid2.createId(),
    userId: user.id,
    questionToStandupId: questionToStandup.id,
    answer,
  });

  const standup = await db.query.standups.findFirst({
    columns: {},
    where: eq(schema.standups.id, currentStandupId),
    with: {
      questionsToStandups: {
        orderBy: (questionsToStandups, { asc }) => [
          asc(questionsToStandups.order),
        ],
        with: {
          question: {
            columns: {
              id: true,
              question: true,
            },
          },
        },
      },
    },
  });

  if (!standup) {
    console.error("No standup found!");
    return;
  }

  if (!standup.questionsToStandups) {
    console.error("No questions found!");
    return;
  }

  const lastId = standup.questionsToStandups.findIndex(
    (q) => q.question.id === lastQuestionId,
  );
  const nextQuestion = standup.questionsToStandups[lastId + 1];

  if (!nextQuestion) {
    await endStandup(user);
    return;
  }

  const nextQuestionId = nextQuestion.question.id;
  const nextQuestionString = nextQuestion.question.question;

  await sendQuestion(
    user,
    nextQuestionId,
    currentStandupId,
    nextQuestionString,
  );
};

const endStandup = async (user: User) => {
  const dmChannel = await user.createDM();

  await db
    .delete(schema.standupProgresses)
    .where(eq(schema.standupProgresses.userId, user.id))
    .execute();

  await dmChannel.sendTyping();
  await sleep(500);

  await dmChannel.send(endMessage);
};

export { onDirectMessage, startStandup };
