import { Events } from "discord.js";
import cron from "node-cron";

import client from "./bot";
import { autocompleteInteraction, executeInteraction } from "./commands";
import { openStandup, saveStandupResponse } from "./standup";

client.on(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  // Run at 15:00 on Fridays
  cron.schedule("0 15 * * Fri", () => {
    console.log("Running cron job...");
  });
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises
client.on(Events.MessageCreate, async (message) => {
  if (message.content === "!ping") {
    await message.reply("Pong!");
  }
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    await autocompleteInteraction(interaction);
  }

  if (interaction.isChatInputCommand()) {
    await executeInteraction(interaction);
  }

  if (interaction.isButton()) {
    const [name, id] = interaction.customId.split("_");

    if (!name || !id) {
      return;
    }

    if (name === "standup-button") {
      await openStandup(interaction, id);
    }
  }

  if (interaction.isModalSubmit()) {
    const [name, id] = interaction.customId.split("_");

    if (!name || !id) {
      return;
    }

    if (name === "standup-modal") {
      await saveStandupResponse(interaction, id);
    }
  }
});
