import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import express from "express";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const app = express();
app.use(express.json());

client.once("clientReady", () => {
  console.log(`🤖 Bot logged in as ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId, user } = interaction;
  if (!customId.startsWith("rsvp:")) return;

  const [, eventId, status] = customId.split(":");

  try {
    // ✅ 1. Defer immediately to acknowledge the interaction
    await interaction.deferUpdate();

    // 🟢 2. Fire-and-forget: resolve user + update RSVP
    (async () => {
      try {
        // Resolve Discord user → app user
        const resolveRes = await fetch(
          `${process.env.FRONTEND_URL}/api/discord/resolve-user`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-bot-secret": process.env.BOT_SECRET,
            },
            body: JSON.stringify({ discordUserId: user.id }),
          }
        );

        if (!resolveRes.ok) return; // silently ignore failures

        // Update RSVP in the app
        await fetch(`${process.env.FRONTEND_URL}/api/events/update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-bot-secret": process.env.BOT_SECRET,
          },
          body: JSON.stringify({ eventId, discordUserId: user.id, status }),
        });
      } catch (err) {
        console.error("Fire-and-forget RSVP update failed", err);
      }
    })();

    // ✅ 3. Done — no need to reply further
  } catch (err) {
    // This should almost never happen since we deferred first
    console.error("Interaction handling failed", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong",
        ephemeral: true,
      });
    }
  }
});

function checkSecret(req, res) {
  if (req.headers["x-bot-secret"] !== process.env.BOT_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function renderRSVPButtons(eventId) {
  return [
    {
      type: 1, // ActionRow
      components: [
        {
          type: 2,
          label: "✅ Attend",
          style: 3, // Success
          custom_id: `rsvp:${eventId}:ATTENDING`,
        },
        {
          type: 2,
          label: "❓ Maybe",
          style: 2, // Secondary
          custom_id: `rsvp:${eventId}:MAYBE`,
        },
        {
          type: 2,
          label: "❌ Not attending",
          style: 4, // Danger
          custom_id: `rsvp:${eventId}:NOT_ATTENDING`,
        },
      ],
    },
  ];
}

app.get("/health", (_req, res) => {
  res.send("ok");
});

app.post("/update-event", async (req, res) => {
  if (!checkSecret(req, res)) return;

  console.log("📝 Received event update request:", req.body);

  const { channelId, messageId, embed, eventId } = req.body;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      console.log("📝 Invalid channel:", channelId);
      return res.status(400).json({ error: "Invalid channel" });
    }

    let message;
    const payload = {
      content: `React to RSVP!`,
      embeds: [embed],
      components: renderRSVPButtons(eventId),
    };

    if (messageId) {
      // Update existing message
      console.log("📝 Updating existing message:", messageId);
      message = await channel.messages.fetch(messageId);
      await message.edit(payload);
    } else {
      // Create new message
      console.log("📝 Creating new message:", payload);
      message = await channel.send(payload);
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
