import { ChannelType, Events } from "discord.js";
import cron from "node-cron";

import client from "./bot";
import { autocompleteInteraction, executeInteraction } from "./commands";
import { onDirectMessage, startStandup } from "./standup";

client.on(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  // Run at 15:00 on Fridays
  cron.schedule("0 15 * * Fri", () => {
    console.log("running a task every minute");
    startStandup().catch(console.error);
  });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.channel.type === ChannelType.DM) {
    await onDirectMessage(message);
  }

  if (
    message.channel.type === ChannelType.GuildText &&
    message.member?.roles.cache.has(process.env.ADMIN_ROLE_ID ?? "")
  ) {
    if (message.content === "/retro") {
      await startStandup();
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  //if (interaction.isModalSubmit()) {
  //}

  if (interaction.isAutocomplete()) {
    await autocompleteInteraction(interaction);
  }

  if (interaction.isChatInputCommand()) {
    await executeInteraction(interaction);
  }
});
