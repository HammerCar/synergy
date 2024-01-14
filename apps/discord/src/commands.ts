import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIApplicationCommandsResult,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { Collection, REST, Routes } from "discord.js";

export interface Command {
  data:
    | SlashCommandBuilder
    | Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">
    | SlashCommandSubcommandsOnlyBuilder;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Collection<string, Command>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderPath = path.join(__dirname, "commands");

(async () => {
  const commandFiles = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".ts"));

  console.log(commandFiles);
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);

    const command = ((await import(filePath)) as { default: Command }).default;

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
      commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }

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
})().catch(console.error);

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
