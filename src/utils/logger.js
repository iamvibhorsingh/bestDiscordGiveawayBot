const dataManager = require('../dataManager');
const messageManager = require('../messageManager');

// Function to log giveaway events
async function logGiveawayEvent(client, guildId, messageKey, placeholders = {}) {
  const actualGuildId = guildId === 'GLOBAL' ? null : guildId;
  const messageContent = messageManager.getMessage(actualGuildId, messageKey, placeholders);
  
  console.log(`[Log][Guild: ${guildId}] ${messageContent}`); // Keep console logging
  const logChannelId = dataManager.getLogChannelForGuild(guildId === 'GLOBAL' ? null : guildId); // Also ensure getLogChannelForGuild handles null if applicable, or we only try to log to channel if not GLOBAL
  
  // Only attempt to send to a guild channel if guildId is not GLOBAL
  if (guildId !== 'GLOBAL' && logChannelId) {
    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(logChannelId);
      if (channel && channel.isTextBased()) {
        await channel.send({ content: `[Giveaway Log] ${messageContent}`, allowedMentions: { parse: [] } });
      } else {
        console.warn(`Log channel ${logChannelId} for guild ${guildId} not found or not text-based.`);
      }
    } catch (error) {
      console.error(`Error sending to log channel for guild ${guildId}:`, error);
    }
  }
}

module.exports = { logGiveawayEvent }; 