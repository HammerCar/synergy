import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import cuid2 from "@paralleldrive/cuid2";
import {
  ChannelType,
  GuildMemberRoleManager,
  SlashCommandBuilder,
} from "discord.js";

import { and, db, eq, like, schema } from "@acme/db";

import type { Command } from "~/commands";
import { startStandup } from "~/standup";

export default {
  data: new SlashCommandBuilder()
    .setName("standup")
    .setDescription("Manage standups.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a standup.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the standup.")
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName("result-channel")
            .setDescription("The channel to post the results to.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all standups."),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("start")
        .setDescription("Start a standup manually.")
        .addStringOption((option) =>
          option
            .setName("standup")
            .setDescription("The standup to start.")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete a standup.")
        .addStringOption((option) =>
          option
            .setName("standup")
            .setDescription("The standup to delete.")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommandGroup((subcommandGroup) =>
      subcommandGroup
        .setName("questions")
        .setDescription("Manage the questions for a standup.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Add a question to a standup.")
            .addStringOption((option) =>
              option
                .setName("standup")
                .setDescription(
                  "The name of the standup to add the question to.",
                )
                .setRequired(true)
                .setAutocomplete(true),
            )
            .addStringOption((option) =>
              option
                .setName("question")
                .setDescription("The question to add.")
                .setRequired(true),
            )
            .addBooleanOption((option) =>
              option
                .setName("private")
                .setDescription(
                  "Whether the question is publicly posted after responding.",
                )
                .setRequired(false),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("list")
            .setDescription("List all questions for a standup.")
            .addStringOption((option) =>
              option
                .setName("standup")
                .setDescription("The standup to list questions for.")
                .setRequired(true)
                .setAutocomplete(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("delete")
            .setDescription("Delete a question from a standup.")
            .addStringOption((option) =>
              option
                .setName("standup")
                .setDescription(
                  "The name of the standup to delete the question from.",
                )
                .setRequired(true)
                .setAutocomplete(true),
            )
            .addStringOption((option) =>
              option
                .setName("question")
                .setDescription("The question to delete.")
                .setRequired(true)
                .setAutocomplete(true),
            ),
        ),
    ),

  async autocomplete(interaction) {
    if (!interaction.inGuild()) {
      await interaction.respond([]);
      return;
    }

    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === "standup") {
      await autocompleteStandup(interaction);
    } else if (focusedOption.name === "question") {
      await autocompleteQuestion(interaction);
    }
  },

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply("This command must be used in a server.");
      return;
    }

    const roles = interaction.member.roles;
    if (
      (roles instanceof GuildMemberRoleManager &&
        !roles.cache.has(process.env.ADMIN_ROLE_ID ?? "")) ||
      (roles instanceof Array &&
        !roles.includes(process.env.ADMIN_ROLE_ID ?? ""))
    ) {
      await interaction.reply("You must be an admin to use this command.");
      return;
    }

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === "questions") {
      if (subcommand === "add") {
        await addQuestion(interaction);
      } else if (subcommand === "list") {
        await listQuestions(interaction);
      } else if (subcommand === "delete") {
        await deleteQuestion(interaction);
      }
    } else if (subcommand === "create") {
      await create(interaction);
    } else if (subcommand === "list") {
      await list(interaction);
    } else if (subcommand === "start") {
      await start(interaction);
    } else if (subcommand === "delete") {
      await deleteStandup(interaction);
    }
  },
} satisfies Command;

const create = async (
  interaction: ChatInputCommandInteraction<"raw" | "cached">,
) => {
  const name = interaction.options.getString("name", true);
  const resultChannel = interaction.options.getChannel("result-channel", true);

  const serverId = interaction.guildId;

  try {
    await db.insert(schema.standups).values({
      id: cuid2.createId(),
      name,
      resultChannelId: resultChannel.id,
      serverId,
      isTemplate: true,
    });

    await interaction.reply(
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      `Standup "${name}" added with result channel ${resultChannel.toString()}!\nAdd questions with \`/standup questions add ${name} <question>\``,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (error.code === "ER_DUP_ENTRY") {
      await interaction.reply(`Standup "${name}" already exists!`);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      await interaction.reply(`Error: ${error.message}`);
    }
  }
};

const list = async (
  interaction: ChatInputCommandInteraction<"raw" | "cached">,
) => {
  const serverId = interaction.guildId;

  const standupTemplates = await db.query.standups.findMany({
    columns: {
      name: true,
    },
    where: and(
      eq(schema.standups.serverId, serverId),
      eq(schema.standups.isTemplate, true),
    ),
  });

  const standupTemplateNames = standupTemplates.map(
    (template) => template.name,
  );

  if (standupTemplateNames.length === 0) {
    await interaction.reply("No standups found!");
    return;
  }

  await interaction.reply(
    `Standups: \n${standupTemplateNames.map((n) => `- ${n}`).join("\n")}`,
  );
};

const start = async (
  interaction: ChatInputCommandInteraction<"raw" | "cached">,
) => {
  const standupTemplateId = interaction.options.getString("standup", true);
  const serverId = interaction.guildId;

  const standupTemplate = await db.query.standups.findFirst({
    columns: {
      name: true,
    },
    where: and(
      eq(schema.standups.serverId, serverId),
      eq(schema.standups.id, standupTemplateId),
      eq(schema.standups.isTemplate, true),
    ),
  });

  if (!standupTemplate) {
    await interaction.reply(`Standup not found!`);
    return;
  }

  try {
    await startStandup(standupTemplateId);
  } catch (error) {
    await interaction.reply(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      `Error: ${(error as any).message}`,
    );
    return;
  }

  await interaction.reply(`Standup "${standupTemplate.name}" started!`);
};

const deleteStandup = async (
  interaction: ChatInputCommandInteraction<"raw" | "cached">,
) => {
  const standupTemplateId = interaction.options.getString("standup", true);
  const serverId = interaction.guildId;

  const standupTemplate = await db.query.standups.findFirst({
    columns: {
      id: true,
      name: true,
    },
    where: and(
      eq(schema.standups.serverId, serverId),
      eq(schema.standups.id, standupTemplateId),
      eq(schema.standups.isTemplate, true),
    ),
  });

  if (!standupTemplate) {
    await interaction.followUp(`Standup not found!`);
    return;
  }

  const name = standupTemplate.name;

  await db
    .delete(schema.questions)
    .where(eq(schema.questions.standupId, standupTemplateId));

  await db
    .delete(schema.standups)
    .where(eq(schema.standups.id, standupTemplateId));

  await interaction.reply(`Standup "${name}" deleted!`);
};

const addQuestion = async (
  interaction: ChatInputCommandInteraction<"raw" | "cached">,
) => {
  const standupTemplateId = interaction.options.getString("standup", true);
  const question = interaction.options.getString("question", true);
  const privateQuestion = interaction.options.getBoolean("private");

  const serverId = interaction.guildId;

  const standupTemplate = await db.query.standups.findFirst({
    columns: {},
    where: and(
      eq(schema.standups.serverId, serverId),
      eq(schema.standups.id, standupTemplateId),
      eq(schema.standups.isTemplate, true),
    ),
    with: {
      questions: {
        columns: {
          order: true,
        },
        orderBy: (questions, { asc }) => [asc(questions.order)],
      },
    },
  });

  if (!standupTemplate) {
    await interaction.reply(`Standup not found!`);
    return;
  }

  const availableOrderNumber = standupTemplate.questions
    .map((t) => t.order)
    .reduce((o, to) => (o === to ? o + 1 : o), 0);

  const questionId = cuid2.createId();
  await db.insert(schema.questions).values({
    id: questionId,
    standupId: standupTemplateId,
    order: availableOrderNumber,
    question,
    private: privateQuestion ?? false,
  });

  const standupTemplateAfter = await db.query.standups.findFirst({
    columns: {
      name: true,
    },
    where: eq(schema.standups.id, standupTemplateId),
    with: {
      questions: {
        columns: {
          question: true,
        },
        orderBy: (questions, { asc }) => [asc(questions.order)],
      },
    },
  });

  const questions = standupTemplateAfter?.questions.map((q) => q.question);

  await interaction.reply(
    `Question "${question}" added to standup ${standupTemplateAfter?.name}!\n\nStandup now has questions:\n${questions
      ?.map((q, index) => `${index + 1}. ${q}`)
      .join("\n")}`,
  );
};

const listQuestions = async (
  interaction: ChatInputCommandInteraction<"raw" | "cached">,
) => {
  const standupTemplateId = interaction.options.getString("standup", true);

  const standupTemplate = await db.query.standups.findFirst({
    columns: {
      name: true,
    },
    where: eq(schema.standups.id, standupTemplateId),
    with: {
      questions: {
        columns: {
          question: true,
        },
        orderBy: (questions, { asc }) => [asc(questions.order)],
      },
    },
  });

  const questions = standupTemplate?.questions.map((q) => q.question);

  await interaction.reply(
    `Questions for standup ${standupTemplate?.name}:\n${questions
      ?.map((q, index) => `${index + 1}. ${q}`)
      .join("\n")}`,
  );
};

const deleteQuestion = async (
  interaction: ChatInputCommandInteraction<"raw" | "cached">,
) => {
  const standupTemplateId = interaction.options.getString("standup", true);
  const questionId = interaction.options.getString("question", true);

  const standupTemplate = await db.query.standups.findFirst({
    columns: {
      name: true,
    },
    where: eq(schema.standups.id, standupTemplateId),
    with: {
      questions: {
        columns: {
          id: true,
          order: true,
          question: true,
        },
        orderBy: (questions, { asc }) => [asc(questions.order)],
      },
    },
  });

  if (!standupTemplate) {
    await interaction.reply(`Standup not found!`);
    return;
  }

  const question = standupTemplate.questions.find((q) => q.id === questionId);

  if (!question) {
    await interaction.reply(`Question not found!`);
    return;
  }

  await db.delete(schema.questions).where(eq(schema.questions.id, question.id));

  for (const q of standupTemplate.questions) {
    if (q.order > question.order) {
      await db
        .update(schema.questions)
        .set({ order: q.order - 1 })
        .where(eq(schema.questions.id, q.id));
    }
  }

  const questions = standupTemplate.questions
    .filter((q) => q.id !== questionId)
    .map((q) => q.question);

  await interaction.reply(
    `Question "${question.question}" deleted from standup ${
      standupTemplate.name
    }!\n\nStandup now has questions:\n${questions
      .map((q, index) => `${index + 1}. ${q}`)
      .join("\n")}`,
  );
};

const autocompleteStandup = async (
  interaction: AutocompleteInteraction<"raw" | "cached">,
) => {
  const standupName = interaction.options.getString("standup", true);
  const serverId = interaction.guildId;

  const standupTemplates = await db.query.standups.findMany({
    columns: {
      id: true,
      name: true,
    },
    where: and(
      and(
        eq(schema.standups.serverId, serverId),
        eq(schema.standups.isTemplate, true),
      ),
      like(schema.standups.name, `%${standupName}%`),
    ),
  });

  const options = standupTemplates.map((template) => ({
    name: template.name,
    value: template.id,
  }));

  await interaction.respond(options);
};

const autocompleteQuestion = async (
  interaction: AutocompleteInteraction<"raw" | "cached">,
) => {
  const standupTemplateOption = interaction.options.get("standup", true);
  const question = interaction.options.getString("question", true);

  //const serverId = interaction.guildId;
  const standupTemplateId = standupTemplateOption.value?.toString() ?? "";

  const standupTemplate = await db.query.standups.findFirst({
    columns: {},
    where: and(eq(schema.standups.id, standupTemplateId)),
    with: {
      questions: {
        columns: {
          id: true,
          question: true,
        },
        orderBy: (questions, { asc }) => [asc(questions.order)],
      },
    },
  });

  if (!standupTemplate) {
    await interaction.respond([]);
    return;
  }

  const options = standupTemplate.questions
    .filter((q) =>
      q.question.toLocaleLowerCase().includes(question.toLocaleLowerCase()),
    )
    .map((q) => ({
      name: q.question,
      value: q.id,
    }));

  await interaction.respond(options);
};
