const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} = require("discord.js");
const { config } = require("dotenv");
// const { YoutubeiExtractor } = require("discord-player-youtubei")

const { useMainPlayer, Player, QueryType  } = require("discord-player");

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

// Ready Event
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
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
      // Search for the track on YouTube
      const searchResults = await player.search(keyword, {
        requestedBy: interaction.user,  // Optionally include the user who requested the song
        searchEngine: QueryType.AUTO         // Use YouTube as the search engine
      });
      console.log('searchResults', searchResults.hasTracks())

      if (!searchResults || searchResults.tracks.length === 0) {
        return interaction.editReply("No results found for the provided search term or keyword.");
      }

      const track = searchResults.tracks[0];
      queue.addTrack(track);
      // Play the track if the queue is not already playing
      if (!queue.node.isPlaying()) await queue.node.play();

      interaction.editReply(`🎶 Now playing: **${track.title}**`);
    } catch (error) {
      console.error("Error playing song:", error);
      interaction.editReply("An error occurred while trying to play the song.");
    }
  }
});

// Register slash commands
client.on("ready", async () => {
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
          description: "keyword or search term",
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
});

// Login to Discord
client.login(DISCORD_TOKEN);
