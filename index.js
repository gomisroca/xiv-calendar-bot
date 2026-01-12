import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import express from "express";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
  ],
});

const app = express();
app.use(express.json());

client.once("clientReady", () => {
  console.log(`🤖 Bot logged in as ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, eventId] = interaction.customId.split("_");

  let status;
  if (action === "rsvpattend") status = EventStatus.ATTENDING;
  else if (action === "rsvpdecline") status = EventStatus.NOT_ATTENDING;

  // 1. Update database
  await fetch(`${FRONTEND_URL}/api/events/rsvp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bot-secret": process.env.BOT_SECRET,
    },
    body: JSON.stringify({ eventId, status, userId: interaction.user.id }),
  });

  // 2. Fetch the updated attendee list from DB
  const attendees = await fetch(
    `${FRONTEND_URL}/api//events/${eventId}/attendance`
  );

  // 3. Edit Discord message
  const message = await interaction.message.fetch();
  await message.edit({
    content: `RSVPs updated!\n${attendees
      .map((a) => `${a.statusEmoji} ${a.username}`)
      .join("\n")}`,
    components: message.components, // keep buttons
  });

  await interaction.reply({
    content: "Your RSVP was recorded!",
    ephemeral: true,
  });
});

app.get("/health", (_req, res) => {
  res.send("ok");
});

app.post("/add-reactions", async (req, res) => {
  if (req.headers["x-bot-secret"] !== process.env.BOT_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("🔃 Received add-reactions request", req.body);

  const { channelId, messageId } = req.body;

  if (!channelId || !messageId) {
    return res.status(400).json({ error: "Missing channelId or messageId" });
  }

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
      return res.status(400).json({ error: "Invalid channel" });
    }

    const message = await channel.messages.fetch(messageId);

    await message.react("✅");
    await message.react("❌");

    console.log("✅ Added reactions to message");

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add reactions" });
  }
});

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`🚀 Bot API running on port ${PORT}`);
});

client
  .login(process.env.DISCORD_BOT_TOKEN)
  .then(() => {
    console.log("✅ Discord client login initiated");
  })
  .catch((err) => {
    console.error("❌ Discord login failed", err);
    process.exit(1);
  });
