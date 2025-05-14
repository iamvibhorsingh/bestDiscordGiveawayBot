const { EmbedBuilder } = require('discord.js');
const dataManager = require('../dataManager');
const { logGiveawayEvent } = require('../utils/logger');
const { selectRandomWinners } = require('../utils/giveawayUtils');
const config = require('../config');
const messageManager = require('../messageManager');
const { parseDuration, msToHuman } = require('../utils/timeUtils');

// End a giveaway and select winners
async function endGiveaway(client, messageId, channelId, guildId, giveawayTimeouts) {
  const giveawayIndex = dataManager.findGiveawayIndex(messageId);
  if (giveawayIndex === -1) {
    logGiveawayEvent(client, guildId, 'LOG_END_GIVEAWAY_NOT_FOUND_IN_MEMORY', { messageId });
    return;
  }
  const giveaway = { ...dataManager.getGiveaways()[giveawayIndex] }; // Work with a copy
  const { prize, hostId, embedColor } = giveaway; // Destructure for easier access

  if (giveaway.ended) {
    console.log(`Giveaway ${messageId} already marked as ended.`);
    return; // Already processed or marked as ended by another call
  }

  giveaway.ended = true;
  dataManager.updateGiveaway(giveawayIndex, giveaway);

  // Clear timeout if it exists
  if (giveawayTimeouts[messageId]) {
    clearTimeout(giveawayTimeouts[messageId]);
    delete giveawayTimeouts[messageId];
  }

  console.log(`Ending giveaway: messageId=${messageId}, channelId=${channelId}, guildId=${guildId}`);
  try {
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      logGiveawayEvent(client, guildId, 'LOG_END_GIVEAWAY_GUILD_NOT_FOUND');
      return;
    }
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logGiveawayEvent(client, guildId, 'LOG_END_GIVEAWAY_CHANNEL_NOT_FOUND');
      return;
    }
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      logGiveawayEvent(client, guildId, 'LOG_END_GIVEAWAY_MESSAGE_NOT_FOUND');
      return;
    }

    const reaction = message.reactions.cache.get('🎁');
    if (!reaction) {
      logGiveawayEvent(client, guildId, 'LOG_END_GIVEAWAY_NO_REACTION', { messageId });
      channel.send(messageManager.getMessage(guildId, 'GIVEAWAY_ENDED_NO_ENTRIES_REACTION_MSG', { prize })).catch(console.error);
      
      const originalDescription = message.embeds[0]?.description || '';
      const newDescription = originalDescription
        .replace(messageManager.getMessage(guildId, 'GIVEAWAY_ENTER_PROMPT'), messageManager.getMessage(guildId, 'GIVEAWAY_ENDED_NO_ONE_ENTERED'))
        .replace(/Time remaining: .*/, messageManager.getMessage(guildId, 'GIVEAWAY_ENDED_PROMPT'));

      const endedEmbedNoWinner = EmbedBuilder.from(message.embeds[0])
        .setColor(config.ENDED_GIVEAWAY_COLOR)
        .setDescription(newDescription)
        .setFooter({ text: `${messageManager.getMessage(guildId, 'GIVEAWAY_FOOTER_ENDED_AT')} • ${new Date().toUTCString()}` });
      await message.edit({ embeds: [endedEmbedNoWinner] }).catch(console.error);
      return;
    }

    const users = await reaction.users.fetch();
    let validEntrants = users.filter(user => !user.bot);

    if (giveaway.requiredRoleId) {
      const role = await guild.roles.fetch(giveaway.requiredRoleId).catch(() => null);
      if (!role) {
        logGiveawayEvent(client, guildId, 'LOG_VALIDATION_ROLE_NOT_FOUND', { context: 'endGiveaway', roleId: giveaway.requiredRoleId, guildName: guild.name, messageId });
      } else {
        const filteredEntrants = [];
        for (const [, user] of validEntrants) {
          try {
            const member = await guild.members.fetch(user.id);
            if (member && member.roles.cache.has(giveaway.requiredRoleId)) {
              filteredEntrants.push(user);
            }
          } catch (err) {
            console.warn(`[Validation] Error fetching member ${user.id} for single role check:`, err.message);
          }
        }
        validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
      }
    }

    // New: Advanced entry requirement checks
    if (giveaway.requiredRoleIdsAll && giveaway.requiredRoleIdsAll.length > 0) {
      const filteredEntrants = [];
      for (const [, user] of validEntrants) {
        try {
          const member = await guild.members.fetch(user.id);
          const hasAllRoles = giveaway.requiredRoleIdsAll.every(roleId => member.roles.cache.has(roleId));
          if (hasAllRoles) {
            filteredEntrants.push(user);
          }
        } catch (err) {
          console.warn(`[Validation] Error fetching member ${user.id} for required_roles_all check:`, err.message);
        }
      }
      validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
    }

    if (giveaway.blacklistedRoleIds && giveaway.blacklistedRoleIds.length > 0) {
      const filteredEntrants = [];
      for (const [, user] of validEntrants) {
        try {
          const member = await guild.members.fetch(user.id);
          const hasBlacklistedRole = giveaway.blacklistedRoleIds.some(roleId => member.roles.cache.has(roleId));
          if (!hasBlacklistedRole) {
            filteredEntrants.push(user);
          }
        } catch (err) {
          console.warn(`[Validation] Error fetching member ${user.id} for blacklisted_roles check:`, err.message);
        }
      }
      validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
    }

    if (giveaway.minServerDurationMs && giveaway.minServerDurationMs > 0) {
      const filteredEntrants = [];
      for (const [, user] of validEntrants) {
        try {
          const member = await guild.members.fetch(user.id);
          if (member.joinedTimestamp && (Date.now() - member.joinedTimestamp >= giveaway.minServerDurationMs)) {
            filteredEntrants.push(user);
          }
        } catch (err) {
          console.warn(`[Validation] Error fetching member ${user.id} for min_server_duration check:`, err.message);
        }
      }
      validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
    }

    if (giveaway.minAccountDurationMs && giveaway.minAccountDurationMs > 0) {
      const filteredEntrants = [];
      for (const [, user] of validEntrants) {
        // user.createdTimestamp is directly available
        if (user.createdTimestamp && (Date.now() - user.createdTimestamp >= giveaway.minAccountDurationMs)) {
          filteredEntrants.push(user);
        }
      }
      validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
    }

    const entrantsArray = Array.from(validEntrants.values());
    const originalEmbed = message.embeds[0];
    
    let currentDescription = originalEmbed.description
        .replace(messageManager.getMessage(guildId, 'GIVEAWAY_ENTER_PROMPT'), messageManager.getMessage(guildId, 'GIVEAWAY_ENDED_PROMPT'));
    currentDescription = currentDescription.replace(/Time remaining: .*/, messageManager.getMessage(guildId, 'GIVEAWAY_ENDED_PROMPT'));


    const endedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(config.ENDED_GIVEAWAY_COLOR)
      .setDescription(currentDescription)
      .setFooter({ text: `${messageManager.getMessage(guildId, 'GIVEAWAY_FOOTER_ENDED_AT')} • ${new Date().toUTCString()}` });
    await message.edit({ embeds: [endedEmbed], components: [] }); // Remove buttons if any

    if (entrantsArray.length === 0) {
      logGiveawayEvent(client, guildId, 'LOG_END_GIVEAWAY_NO_VALID_ENTRANTS', { prize });
      channel.send(messageManager.getMessage(guildId, 'GIVEAWAY_ENDED_NO_ENTRIES_MSG', { prize })).catch(console.error);
      return;
    }

    const winnerCount = Math.min(giveaway.winnersCount, entrantsArray.length);
    const winners = selectRandomWinners(entrantsArray, winnerCount);
    const winnerMentions = winners.map(w => `<@${w.id}>`).join(', ');

    const winnerEmbed = new EmbedBuilder()
      .setTitle(messageManager.getMessage(guildId, 'GIVEAWAY_ENDED_EMBED_TITLE'))
      .setColor(embedColor || config.ENDED_GIVEAWAY_COLOR)
      .setDescription(messageManager.getMessage(guildId, 'GIVEAWAY_WINNER_ANNOUNCEMENT_EMBED_DESC', {
          prize,
          winnerMentions,
          hostId,
          s_plural: winners.length > 1 ? 's' : ''
      }))
      .setFooter({ text: messageManager.getMessage(guildId, 'GIVEAWAY_FOOTER_ID', { messageId }) })
      .setTimestamp();
    if (giveaway.imageUrl) winnerEmbed.setThumbnail(giveaway.imageUrl);

    await channel.send({
      content: messageManager.getMessage(guildId, 'GIVEAWAY_WINNER_ANNOUNCEMENT_MSG', { winnerMentions, prize }),
      embeds: [winnerEmbed]
    });
    logGiveawayEvent(client, guildId, 'LOG_GIVEAWAY_ENDED', { prize, messageId, winnerMentions });

  } catch (error) {
    console.error('Error ending giveaway:', error);
    logGiveawayEvent(client, guildId, 'LOG_END_GIVEAWAY_ERROR', { messageId, errorMessage: error.message });
    // Attempt to notify in channel if possible
    try {
        const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
            channel.send(messageManager.getMessage(guildId, 'ERROR_ENDING_GIVEAWAY_GENERIC', { prize: giveaway.prize, messageId })).catch(console.error);
        }
    } catch (e) {
        console.error('Failed to send error message to channel:', e);
    }
  }
}

// Reroll winners for a giveaway
async function rerollGiveaway(client, messageId, channelId, guildId, newWinnersCount) {
  const giveaway = dataManager.findGiveaway(messageId);
  const { prize, hostId, embedColor } = giveaway || {}; // Destructure, provide default if giveaway is null

  if (!giveaway || !giveaway.ended) {
    logGiveawayEvent(client, guildId, 'LOG_REROLL_GIVEAWAY_NOT_FOUND_OR_NOT_ENDED', { messageId });
    return { success: false, message: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_NOT_FOUND') }; // Or ERROR_GIVEAWAY_NOT_ENDED_YET based on actual check in command
  }

  logGiveawayEvent(client, guildId, 'LOG_REROLL_GIVEAWAY_DETAILS', { messageId, prize, newWinnersCount: newWinnersCount || giveaway.winnersCount });
  try {
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      logGiveawayEvent(client, guildId, 'LOG_REROLL_GIVEAWAY_GUILD_NOT_FOUND');
      return { success: false, message: 'Guild not found.' }; // Internal error, not directly shown
    }
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logGiveawayEvent(client, guildId, 'LOG_REROLL_GIVEAWAY_CHANNEL_NOT_FOUND');
      return { success: false, message: 'Channel not found.' }; // Internal error
    }
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      logGiveawayEvent(client, guildId, 'LOG_REROLL_GIVEAWAY_MESSAGE_NOT_FOUND');
      return { success: false, message: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_NOT_FOUND') }; // Could be shown to user
    }

    const reaction = message.reactions.cache.get('🎁');
    if (!reaction) {
      logGiveawayEvent(client, guildId, 'LOG_REROLL_GIVEAWAY_NO_REACTION', { messageId });
      return { success: false, message: messageManager.getMessage(guildId, 'ERROR_NO_REACTION_FOR_WINNERS') };
    }

    const users = await reaction.users.fetch();
    let validEntrants = users.filter(user => !user.bot);

    if (giveaway.requiredRoleId) {
      const role = await guild.roles.fetch(giveaway.requiredRoleId).catch(() => null);
      if (!role) {
        logGiveawayEvent(client, guildId, 'LOG_VALIDATION_ROLE_NOT_FOUND', { context: 'rerollGiveaway', roleId: giveaway.requiredRoleId, guildName: guild.name, messageId });
      } else {
        const filteredEntrants = [];
        for (const [, user] of validEntrants) {
          try {
            const member = await guild.members.fetch(user.id);
            if (member && member.roles.cache.has(giveaway.requiredRoleId)) {
              filteredEntrants.push(user);
            }
          } catch (err) {
             console.warn(`[Validation-Reroll] Error fetching member ${user.id} for single role check:`, err.message);
          }
        }
        validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
      }
    }

    // New: Advanced entry requirement checks for reroll
    if (giveaway.requiredRoleIdsAll && giveaway.requiredRoleIdsAll.length > 0) {
      const filteredEntrants = [];
      for (const [, user] of validEntrants) {
        try {
          const member = await guild.members.fetch(user.id);
          const hasAllRoles = giveaway.requiredRoleIdsAll.every(roleId => member.roles.cache.has(roleId));
          if (hasAllRoles) {
            filteredEntrants.push(user);
          }
        } catch (err) {
          console.warn(`[Validation-Reroll] Error fetching member ${user.id} for required_roles_all check:`, err.message);
        }
      }
      validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
    }

    if (giveaway.blacklistedRoleIds && giveaway.blacklistedRoleIds.length > 0) {
      const filteredEntrants = [];
      for (const [, user] of validEntrants) {
        try {
          const member = await guild.members.fetch(user.id);
          const hasBlacklistedRole = giveaway.blacklistedRoleIds.some(roleId => member.roles.cache.has(roleId));
          if (!hasBlacklistedRole) {
            filteredEntrants.push(user);
          }
        } catch (err) {
          console.warn(`[Validation-Reroll] Error fetching member ${user.id} for blacklisted_roles check:`, err.message);
        }
      }
      validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
    }

    if (giveaway.minServerDurationMs && giveaway.minServerDurationMs > 0) {
      const filteredEntrants = [];
      for (const [, user] of validEntrants) {
        try {
          const member = await guild.members.fetch(user.id);
          if (member.joinedTimestamp && (Date.now() - member.joinedTimestamp >= giveaway.minServerDurationMs)) {
            filteredEntrants.push(user);
          }
        } catch (err) {
          console.warn(`[Validation-Reroll] Error fetching member ${user.id} for min_server_duration check:`, err.message);
        }
      }
      validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
    }

    if (giveaway.minAccountDurationMs && giveaway.minAccountDurationMs > 0) {
      const filteredEntrants = [];
      for (const [, user] of validEntrants) {
        if (user.createdTimestamp && (Date.now() - user.createdTimestamp >= giveaway.minAccountDurationMs)) {
          filteredEntrants.push(user);
        }
      }
      validEntrants = validEntrants.filter(u => filteredEntrants.some(fu => fu.id === u.id));
    }

    const entrantsArray = Array.from(validEntrants.values());
    if (entrantsArray.length === 0) {
      logGiveawayEvent(client, guildId, 'LOG_REROLL_GIVEAWAY_NO_VALID_ENTRANTS', { prize });
      return { success: false, message: messageManager.getMessage(guildId, 'ERROR_NO_VALID_ENTRANTS_FOR_REROLL', { prize }) };
    }

    const winnerCountToReroll = Math.min(newWinnersCount || giveaway.winnersCount, entrantsArray.length);
    const winners = selectRandomWinners(entrantsArray, winnerCountToReroll);
    const winnerMentions = winners.map(w => `<@${w.id}>`).join(', ');

    const rerollEmbed = new EmbedBuilder()
      .setTitle(messageManager.getMessage(guildId, 'GIVEAWAY_REROLLED_EMBED_TITLE'))
      .setColor(embedColor || config.ENDED_GIVEAWAY_COLOR)
      .setDescription(messageManager.getMessage(guildId, 'GIVEAWAY_REROLLED_WINNER_ANNOUNCEMENT_EMBED_DESC', {
          prize,
          winnerMentions,
          hostId,
          s_plural: winners.length > 1 ? 's' : ''
      }))
      .setFooter({ text: messageManager.getMessage(guildId, 'GIVEAWAY_FOOTER_ID', { messageId }) })
      .setTimestamp();
     if (giveaway.imageUrl) rerollEmbed.setThumbnail(giveaway.imageUrl);

    await channel.send({
      content: messageManager.getMessage(guildId, 'GIVEAWAY_REROLLED_WINNER_ANNOUNCEMENT_MSG', { winnerMentions, prize }),
      embeds: [rerollEmbed]
    });
    logGiveawayEvent(client, guildId, 'LOG_GIVEAWAY_REROLLED_WINNERS', { prize, messageId, winnerMentions });
    return { success: true, message: messageManager.getMessage(guildId, 'GIVEAWAY_REROLLED_SUCCESS_EPHEMERAL', { winnerMentions }) };

  } catch (error) {
    console.error('Error rerolling giveaway:', error);
    logGiveawayEvent(client, guildId, 'LOG_REROLL_GIVEAWAY_ERROR', { messageId, errorMessage: error.message });
    return { success: false, message: messageManager.getMessage(guildId, 'ERROR_REROLLING_GIVEAWAY_GENERIC') };
  }
}

// Initiate a scheduled giveaway
async function initiateScheduledGiveaway(client, scheduleId, giveawayTimeouts) {
  const giveawayIndex = dataManager.findScheduledGiveawayIndex(scheduleId);
  if (giveawayIndex === -1) {
    console.error(`Scheduled giveaway with scheduleId ${scheduleId} not found, already started, or ended.`);
    if (giveawayTimeouts[scheduleId]) {
        clearTimeout(giveawayTimeouts[scheduleId]);
        delete giveawayTimeouts[scheduleId];
    }
    return;
  }

  const giveawayData = { ...dataManager.getGiveaways()[giveawayIndex] }; // Work with a copy
  const guildIdForLog = giveawayData.guildId; // Use this for messageManager calls too

  try {
    const guild = await client.guilds.fetch(giveawayData.guildId);
    if (!guild) {
      logGiveawayEvent(client, guildIdForLog, 'LOG_SCHEDULED_GIVEAWAY_FAIL_GUILD_NOT_FOUND', { guildId: giveawayData.guildId, scheduleId });
      giveawayData.isScheduled = false;
      giveawayData.ended = true;
      giveawayData.prize = messageManager.getMessage(guildIdForLog, 'GIVEAWAY_SCHEDULED_FAIL_GUILD_PREFIX') + giveawayData.prize;
      dataManager.updateGiveaway(giveawayIndex, giveawayData);
      return;
    }
    const channel = await guild.channels.fetch(giveawayData.channelId);
    if (!channel || !channel.isTextBased()) {
      logGiveawayEvent(client, guildIdForLog, 'LOG_SCHEDULED_GIVEAWAY_FAIL_CHANNEL_NOT_FOUND', { channelId: giveawayData.channelId, scheduleId });
      giveawayData.isScheduled = false;
      giveawayData.ended = true;
      giveawayData.prize = messageManager.getMessage(guildIdForLog, 'GIVEAWAY_SCHEDULED_FAIL_CHANNEL_PREFIX') + giveawayData.prize;
      dataManager.updateGiveaway(giveawayIndex, giveawayData);
      return;
    }

    let description = `**${giveawayData.prize}**\n\n`;
    description += messageManager.getMessage(guildIdForLog, 'GIVEAWAY_ENTER_PROMPT');
    description += messageManager.getMessage(guildIdForLog, 'GIVEAWAY_EMBED_TIME_REMAINING', { endTimeTimestamp: Math.floor(giveawayData.endTime/1000) });
    description += messageManager.getMessage(guildIdForLog, 'GIVEAWAY_EMBED_WINNERS_COUNT', { winnersCount: giveawayData.winnersCount });
    description += messageManager.getMessage(guildIdForLog, 'GIVEAWAY_EMBED_HOSTED_BY', { hostId: giveawayData.hostId });

    if (giveawayData.requiredRoleId) {
        description += messageManager.getMessage(guildIdForLog, 'GIVEAWAY_EMBED_REQ_ROLE', { roleId: giveawayData.requiredRoleId });
    }
    if (giveawayData.requiredRoleIdsAll && giveawayData.requiredRoleIdsAll.length > 0) {
        const roleMentions = giveawayData.requiredRoleIdsAll.map(id => `<@&${id}>`).join(', ');
        description += messageManager.getMessage(guildIdForLog, 'GIVEAWAY_EMBED_REQ_ROLES_ALL', { roleMentions });
    }
    if (giveawayData.blacklistedRoleIds && giveawayData.blacklistedRoleIds.length > 0) {
        const roleMentions = giveawayData.blacklistedRoleIds.map(id => `<@&${id}>`).join(', ');
        description += messageManager.getMessage(guildIdForLog, 'GIVEAWAY_EMBED_BLACKLIST_ROLES', { roleMentions });
    }
    if (giveawayData.minServerDurationMs) {
        description += messageManager.getMessage(guildIdForLog, 'GIVEAWAY_EMBED_MIN_SERVER_AGE', { duration: msToHuman(giveawayData.minServerDurationMs, guildIdForLog) });
    }
    if (giveawayData.minAccountDurationMs) {
        description += messageManager.getMessage(guildIdForLog, 'GIVEAWAY_EMBED_MIN_ACCOUNT_AGE', { duration: msToHuman(giveawayData.minAccountDurationMs, guildIdForLog) });
    }

    const giveawayEmbed = new EmbedBuilder()
      .setTitle(messageManager.getMessage(guildIdForLog, 'GIVEAWAY_STARTING_EMBED_TITLE'))
      .setDescription(description)
      .setColor(giveawayData.embedColor || config.DEFAULT_GIVEAWAY_COLOR)
      .setFooter({ text: `${messageManager.getMessage(guildIdForLog, 'GIVEAWAY_FOOTER_ENDS_AT')} • ${new Date(giveawayData.endTime).toUTCString()}` })
      .setTimestamp();

    if (giveawayData.imageUrl) {
      giveawayEmbed.setImage(giveawayData.imageUrl);
    }

    const giveawayMessage = await channel.send({ embeds: [giveawayEmbed] });
    await giveawayMessage.react('🎁');

    // Update the giveaway in the main array
    giveawayData.messageId = giveawayMessage.id;
    giveawayData.isScheduled = false;
    dataManager.updateGiveaway(giveawayIndex, giveawayData);

    logGiveawayEvent(client, guildIdForLog, 'LOG_SCHEDULED_GIVEAWAY_STARTED', {
        prize: giveawayData.prize,
        scheduleId,
        messageId: giveawayMessage.id,
        hostId: giveawayData.hostId,
        durationSecs: giveawayData.durationMs / 1000
    });
    console.log(`Giveaway ${giveawayData.prize} (formerly ${scheduleId}) started with messageId ${giveawayMessage.id}. Duration: ${giveawayData.durationMs}ms`);
    
    // Clear scheduled timeout and set the main end timeout
    if (giveawayTimeouts[scheduleId]) {
        clearTimeout(giveawayTimeouts[scheduleId]);
        delete giveawayTimeouts[scheduleId];
    }
    giveawayTimeouts[giveawayMessage.id] = setTimeout(() => endGiveaway(client, giveawayMessage.id, giveawayData.channelId, giveawayData.guildId, giveawayTimeouts), giveawayData.durationMs);

  } catch (error) {
    logGiveawayEvent(client, guildIdForLog, 'LOG_SCHEDULED_GIVEAWAY_INIT_ERROR', { scheduleId, prize: giveawayData.prize, errorMessage: error.message });
    const gIndex = dataManager.findScheduledGiveawayIndex(scheduleId); // Re-fetch index in case of async issues
    if (gIndex !== -1) {
        const failedGiveaway = { ...dataManager.getGiveaways()[gIndex] }; 
        failedGiveaway.isScheduled = false; 
        failedGiveaway.ended = true; 
        failedGiveaway.prize = messageManager.getMessage(guildIdForLog, 'GIVEAWAY_SCHEDULED_FAIL_GENERIC_PREFIX') + failedGiveaway.prize;
        dataManager.updateGiveaway(gIndex, failedGiveaway);
    }
    if (giveawayTimeouts[scheduleId]) {
        clearTimeout(giveawayTimeouts[scheduleId]);
        delete giveawayTimeouts[scheduleId];
    }
  }
}

module.exports = {
  endGiveaway,
  rerollGiveaway,
  initiateScheduledGiveaway
}; 