const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} = require("discord.js");
const { config } = require("dotenv");
const { Player, QueryType } = require("discord-player");
const { YoutubeiExtractor } = require("discord-player-youtubei");

// Load environment variables
config();

const { DISCORD_TOKEN, CLIENT_ID } = process.env;

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel],
});

// Initialize Player
const player = new Player(client, {
  leaveOnEnd: false, // Stay connected after queue ends
  leaveOnStop: false, // Stay connected after manual stop
  leaveOnEmpty: true, // Leave only if the voice channel is empty
  bufferingTimeout: 3000, // Timeout for buffering (ms)
  initialVolume: 50, // Default volume level
});

// Add the YouTubeiExtractor to the player
player.extractors.register(YoutubeiExtractor, {});

// Ready Event
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  registerCommands();
  await player.extractors.loadDefault();
});

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "play") {
    const keyword = interaction.options.getString("keyword");

    // Validate keyword or search term
    if (!keyword) {
      return interaction.reply(
        "Please provide a valid YouTube keyword or search term."
      );
    }

    // Ensure the user is in a voice channel
    if (!interaction.member.voice.channel) {
      return interaction.reply(
        "You need to be in a Voice Channel to play music."
      );
    }

    await interaction.deferReply();

    try {
      const voiceChannel = interaction.member.voice.channel;

      // Create a queue if it doesn't exist
      const queue = player.nodes.create(voiceChannel.guild.id);

      // Ensure the bot joins the voice channel
      if (!queue.connection) {
        await queue.connect(voiceChannel); // Connect to the voice channel
      }

      // Search for the track on YouTube using the YouTubeiExtractor
      const searchResults = await player.search(keyword, {
        requestedBy: interaction.user, // Optionally include the user who requested the song
        searchEngine: QueryType.YOUTUBE, // Explicitly use YouTube as the search engine
      });

      if (!searchResults.hasTracks()) {
        return interaction.editReply(
          "No results found for the provided search term or keyword."
        );
      }

      // Play the track on the voice channel
      await player.play(voiceChannel, searchResults, {
        nodeOptions: {
          metadata: {
            channel: voiceChannel,
            client: interaction.guild?.members.me,
          },
          leaveOnEnd: true,
          leaveOnEndCooldown: 50000,
          volume: 50,
        },
      });

      interaction.editReply(
        `🎶 Now playing: **${searchResults.tracks[0].title}**`
      );
    } catch (error) {
      console.error("Error playing song:", error);
      interaction.editReply("An error occurred while trying to play the song.");
    }
  }

  if (interaction.commandName === "skip") {
    const queue = player.nodes.get(interaction.guild.id);
    if (!queue || !queue.node.isPlaying()) {
      return interaction.reply("There is no song currently playing.");
    }

    try {
      queue.node.skip();
      interaction.reply("⏭️ Skipped the current song.");
    } catch (error) {
      console.error("Error skipping song:", error);
      interaction.reply("An error occurred while trying to skip the song.");
    }
  }

  if (interaction.commandName === "stop") {
    const queue = player.nodes.get(interaction.guild.id);
    if (!queue) {
      return interaction.reply("There is no song currently playing.");
    }

    try {
      queue.delete();
      interaction.reply("🛑 Stopped the music and cleared the queue.");
    } catch (error) {
      console.error("Error stopping song:", error);
      interaction.reply("An error occurred while trying to stop the song.");
    }
  }
});

// Register slash commands
async function registerCommands() {
  const guildId = client.guilds.cache.map((guild) => guild.id);
  const commands = [
    {
      type: 1,
      name: "play",
      description: "Searches for a song and plays it",
      options: [
        {
          type: 3,
          name: "keyword",
          description: "Keyword or search term",
          required: true,
        },
      ],
    },
    {
      type: 1,
      name: "queue",
      description: "Shows the current song queue",
    },
    {
      type: 1,
      name: "skip",
      description: "Skips the current song in the queue",
    },
    {
      type: 1,
      name: "stop",
      description: "Stops the music and clears the queue",
    },
  ];

  const rest = new REST({ version: "9" }).setToken(DISCORD_TOKEN);

  rest
    .put(Routes.applicationGuildCommands(CLIENT_ID, guildId), {
      body: commands,
    })
    .then(() =>
      console.log("Successfully updated commands for guild " + guildId)
    )
    .catch(console.error);

  console.log("Slash commands registered.");
}

// Login to Discord
client.login(DISCORD_TOKEN);
