const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} = require("discord.js");
const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { SoundCloudPlugin } = require("@distube/soundcloud");
const { YtDlpPlugin } = require("@distube/yt-dlp");
const { config } = require("dotenv");

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

// Initialize DisTube with plugins
const distube = new DisTube(client, {
  emitNewSongOnly: true,
  plugins: [new SpotifyPlugin(), new SoundCloudPlugin(), new YtDlpPlugin()],
});

// Ready Event
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "play") {
    const url = interaction.options.getString("url");

    // Validate URL or search term
    if (!url) {
      return interaction.reply(
        "Please provide a valid YouTube URL or search term."
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
      // Play music
      await distube.play(interaction.member.voice.channel, url, {
        member: interaction.member,
        textChannel: interaction.channel,
        interaction,
      });

      interaction.editReply(`Searching and playing: **${url}**`);
    } catch (error) {
      console.error("Error playing song:", error);
      interaction.editReply("An error occurred while trying to play the song.");
    }
  }

  if (interaction.commandName === "queue") {
    const queue = distube.getQueue(interaction.guild.id);
    if (!queue) {
      return interaction.reply("There is no song in the queue.");
    }

    const queueList = queue.songs
      .map((song, index) => `${index + 1}. **${song.name}** - \`${song.formattedDuration}\``)
      .join("\n");

    interaction.reply(`**Current Queue**\n${queueList}`);
  }
});

// DisTube Events
distube
  .on("playSong", (queue, song) => {
    queue.textChannel.send(
      `🎶 Now playing: **${song.name}** - \`${song.formattedDuration}\`\n` +
      `Next in queue: **${queue.songs[1]?.name || "No more songs in queue"}**`
    );
  })
  .on("addSong", (queue, song) => {
    queue.textChannel.send(
      `✅ Added to queue: **${song.name}** - \`${song.formattedDuration}\`\n` +
      `Next in queue: **${queue.songs[1]?.name || "No more songs in queue"}**`
    );
  })
  .on("error", (channel, error) => {
    console.error(error);
    if (channel) channel.send(`❌ An error encountered: ${error.message}`);
  });

// Register slash commands
client.on("ready", async () => {
  const guildId = "1088800296949514261"; // Replace with your server's ID
  const commands = [
    {
      type: 1,
      name: "play",
      description: "Searches for a song and plays it",
      options: [
        {
          type: 3,
          name: "url",
          description: "URL or search term",
          required: true,
        },
      ],
    },
    {
      type: 1,
      name: "queue",
      description: "Shows the current song queue",
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
});

// Login to Discord
client.login(DISCORD_TOKEN);
