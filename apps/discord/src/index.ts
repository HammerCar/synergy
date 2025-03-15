import cuid2 from "@paralleldrive/cuid2";
import { format } from "date-fns";
import { Events } from "discord.js";
import { activities } from "node_modules/@acme/db/src/schema/activity";
import cron from "node-cron";

import { db } from "@acme/db";

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
  console.log(message.author);

  if (message.content === "!ping") {
    await message.reply("Pong!");
  }

  await db
    .insert(activities)
    .values({
      id: cuid2.createId(),
      userId: message.author.id,
      date: format(new Date(), "yyyy-MM-dd"),
    })
    .onConflictDoNothing();
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
