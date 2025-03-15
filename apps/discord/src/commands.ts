import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIApplicationCommandsResult,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { Collection, REST, Routes } from "discord.js";

import activity from "./commands/activity";
import standups from "./commands/standups";

export interface Command {
  data:
    | SlashCommandBuilder
    | Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">
    | SlashCommandSubcommandsOnlyBuilder;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Collection<string, Command>();

export const addCommand = (name: string, command: Command) => {
  if ("data" in command && "execute" in command) {
    commands.set(command.data.name, command);

    console.log(`Command ${name} has been added.`);
  } else {
    console.log(
      `[WARNING] The command ${name} is missing a required "data" or "execute" property.`,
    );
  }
};

addCommand("standups", standups);
addCommand("activity", activity);

const updateDiscordCommands = async () => {
  // Construct and prepare an instance of the REST module
  const rest = new REST().setToken(process.env.DISCORD_TOKEN ?? "");

  // and deploy your commands!
  try {
    console.log(
      `Started refreshing ${commands.size} application (/) commands.`,
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = (await rest.put(
      Routes.applicationCommands(process.env.APPLICATION_ID ?? ""),
      { body: commands.map((command) => command.data.toJSON()) },
    )) as RESTPostAPIApplicationCommandsResult[];

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`,
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
};
setTimeout(() => {
  updateDiscordCommands().catch(console.error);
}, 10_000);

export const autocompleteInteraction = async (
  interaction: AutocompleteInteraction,
) => {
  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  if (command.autocomplete) {
    await command.autocomplete(interaction);
  }
};

export const executeInteraction = async (
  interaction: ChatInputCommandInteraction,
) => {
  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
};
