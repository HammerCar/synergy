import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import cuid2 from "@paralleldrive/cuid2";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { and, db, eq, schema } from "@acme/db";

import client from "./bot";

const startStandup = async (standupTemplateId: string) => {
  console.log("Starting standup...");

  const [standupId, resultChannelId] =
    await createStandupFromTemplate(standupTemplateId);

  const standupButton = new ButtonBuilder()
    .setCustomId("standup-button_" + standupId)
    .setLabel("Participate")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    standupButton,
  );

  const channel = await client.channels.fetch(resultChannelId ?? "");

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    throw new Error("Channel not found!");
  }

  await channel.send({
    content: "Standup time @everyone!",
    components: [row],
  });
};

const createStandupFromTemplate = async (standupTemplateId: string) => {
  const standupTemplate = await db.query.standups.findFirst({
    columns: {
      name: true,
      resultChannelId: true,
      serverId: true,
    },
    where: and(
      and(
        eq(schema.standups.id, standupTemplateId),
        eq(schema.standups.serverId, process.env.GUILD_ID ?? ""),
        eq(schema.standups.isTemplate, true),
      ),
    ),
    with: {
      questions: {
        columns: {
          id: true,
          question: true,
          order: true,
          private: true,
        },
      },
    },
  });

  if (!standupTemplate) {
    throw new Error("No standup template found!");
  }

  const questions = standupTemplate.questions;
  if (!questions.length) {
    throw new Error("No questions found!");
  }

  const standupId = cuid2.createId();
  await db.insert(schema.standups).values({
    id: standupId,
    name: standupTemplate.name,
    resultChannelId: standupTemplate.resultChannelId,
    serverId: standupTemplate.serverId,
    isTemplate: false,
  });

  for (const question of questions) {
    await db.insert(schema.questions).values({
      id: cuid2.createId(),
      standupId,
      question: question.question,
      order: question.order,
      private: question.private,
    });
  }

  return [standupId, standupTemplate.resultChannelId];
};

const openStandup = async (
  interaction: ButtonInteraction,
  standupId: string,
) => {
  console.log("user", interaction.user.id, "is opening standup", standupId);

  const standup = await db.query.standups.findFirst({
    where: eq(schema.standups.id, standupId),
    with: {
      questions: {
        columns: {
          id: true,
          question: true,
        },
        orderBy: (questions, { asc }) => [asc(questions.order)],
        with: {
          answers: {
            columns: {
              userId: true,
            },
            where: eq(schema.answers.userId, interaction.user.id),
          },
        },
      },
    },
  });

  if (!standup) {
    throw new Error("No standup found!");
  }

  const questions = standup.questions.filter(
    (question) => !question.answers.length,
  );

  if (!questions.length) {
    await interaction.reply({
      content: "You have already answered to this standup!",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("standup-modal_" + standupId)
    .setTitle(standup.name);

  for (const question of questions) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(question.id)
          .setLabel(question.question)
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph),
      ),
    );
  }

  await interaction.showModal(modal);
};

const saveStandupResponse = async (
  interaction: ModalSubmitInteraction,
  standupId: string,
) => {
  console.log("user", interaction.user.id, "is saving standup", standupId);

  const standup = await db.query.standups.findFirst({
    columns: {
      name: true,
      resultChannelId: true,
    },
    where: eq(schema.standups.id, standupId),
    with: {
      questions: {
        columns: {
          id: true,
          question: true,
          private: true,
        },
        orderBy: (questions, { asc }) => [asc(questions.order)],
      },
    },
  });

  if (!standup) {
    throw new Error("No standup found!");
  }

  const questions = standup.questions.map((question) => {
    const answer = interaction.fields.getTextInputValue(question.id);

    if (!answer) {
      throw new Error("No answer found!");
    }

    return {
      ...question,
      answer,
    };
  });

  try {
    for (const question of questions) {
      await db.insert(schema.answers).values({
        id: cuid2.createId(),
        userId: interaction.user.id,
        questionId: question.id,
        answer: question.answer,
      });
    }
  } catch (error) {
    await interaction.reply({
      content: "There was an error while saving your response!",
      ephemeral: true,
    });
    return;
  }

  const channel = await client.channels.fetch(standup.resultChannelId);

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    throw new Error("Channel not found!");
  }

  let message = `${interaction.user.toString()}'s ${standup.name}:\n\n`;

  for (const question of questions) {
    if (!question.private) {
      message += `> **${question.question}**\n> ${question.answer}\n\n`;
    }
  }

  await channel.send(message);

  await interaction.reply({
    content: "Standup response saved!",
    ephemeral: true,
  });
};

export { openStandup, saveStandupResponse, startStandup };
