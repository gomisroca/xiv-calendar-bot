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

function checkSecret(req, res) {
  if (req.headers["x-bot-secret"] !== process.env.BOT_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

app.get("/health", (_req, res) => {
  res.send("ok");
});

app.post("/update-event", async (req, res) => {
  if (!checkSecret(req, res)) return;

  const { channelId, messageId, embed } = req.body;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      return res.status(400).json({ error: "Invalid channel" });
    }

    let message;
    const payload = {
      content: `React to RSVP!`,
      embeds: [embed],
    };

    if (messageId) {
      // Update existing message
      message = await channel.messages.fetch(messageId);
      await message.edit(payload);
    } else {
      // Create new message
      message = await channel.send(payload);

      await message.react("✅");
      await message.react("❌");
    }

    return res.json({
      channelId: message.channelId,
      messageId: message.id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to post/update event" });
  }
});

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, "0.0.0.0", () => {
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
