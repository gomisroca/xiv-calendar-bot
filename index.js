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

app.get("/health", (_req, res) => {
  res.send("ok");
});

app.post("/add-reactions", async (req, res) => {
  if (req.headers["x-bot-secret"] !== process.env.BOT_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

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

client.login(process.env.DISCORD_BOT_TOKEN);
