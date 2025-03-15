import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { GuildMemberRoleManager, SlashCommandBuilder } from "discord.js";

import { countDistinct, db, eq, schema } from "@acme/db";

import type { Command } from "~/commands";

export default {
  data: new SlashCommandBuilder()
    .setName("activity")
    .setDescription("List activity."),

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

    await list(interaction);
  },
} satisfies Command;

const list = async (
  interaction: ChatInputCommandInteraction<"raw" | "cached">,
) => {
  const serverId = interaction.guildId;

  const userActivityCounts = await db
    .select({
      userId: schema.activities.userId,
      count: countDistinct(schema.activities.date).as("count"),
    })
    .from(schema.activities)
    .where(eq(schema.activities.serverId, serverId))
    .groupBy(schema.activities.userId);

  // Fetch users one by one and collect results
  const users = new Map<string, GuildMember>();

  const guild = interaction.guild;
  if (guild) {
    await Promise.all(
      userActivityCounts.map(async ({ userId }) => {
        try {
          const member = await guild.members.fetch(userId);
          if (member) users.set(userId, member);
        } catch (error) {
          // Skip users that couldn't be fetched
          console.error(`Failed to fetch user ${userId}:`, error);
        }
      }),
    );
  }

  const userActivities = userActivityCounts.map(({ userId, count }) => {
    const user = users.get(userId);
    return `${user?.displayName} (${count})`;
  });

  if (!userActivities.length) {
    await interaction.reply("No activity found!");
    return;
  }

  await interaction.reply(
    `Activity: \n${userActivities
      .map((n, i) => `- ${i + 1}. ${n}`)
      .join("\n")}`,
  );
};
