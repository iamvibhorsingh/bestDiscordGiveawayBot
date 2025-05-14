const { EmbedBuilder } = require('discord.js');
const dataManager = require('../../dataManager');
const { logGiveawayEvent } = require('../../utils/logger');
const { parseDuration, msToHuman } = require('../../utils/timeUtils');
const messageManager = require('../../messageManager');
const giveawayManager = require('../../core/giveawayManager'); // For endGiveaway timeout management
const config = require('../../config');

module.exports = async function handleEdit(interaction, client, giveawayTimeouts) {
    const guildId = interaction.guildId;
    const messageId = interaction.options.getString('message_id');
    const changedFields = []; // For logging

    // --- Collect all provided option values to build a summary for logging ---
    const optionsSummary = [];
    interaction.options.data[0].options.forEach(opt => {
        if (opt.name !== 'message_id') { // Don't log the message_id as a change itself
            optionsSummary.push(`${opt.name}: ${opt.value}`);
        }
    });
    const attemptLogPlaceholders = {
        userId: interaction.user.id,
        messageId: messageId,
        changesSummaryString: optionsSummary.join(', ') || 'No specific options provided'
    };
    await logGiveawayEvent(client, guildId, 'LOG_GIVEAWAY_EDIT_ATTEMPT', attemptLogPlaceholders);

    const giveawayIndex = dataManager.findGiveawayIndex(messageId);
    if (giveawayIndex === -1) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_NOT_FOUND'), ephemeral: true });
    }

    let giveaway = { ...dataManager.getGiveaways()[giveawayIndex] }; // Work with a copy

    if (giveaway.ended) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_ALREADY_ENDED'), ephemeral: true });
    }
    if (giveaway.isScheduled) {
        // This check means it's scheduled but not yet started (messageId would be null/undefined until it starts)
        // Or, if it did start but somehow this flag wasn't cleared, that's also an issue.
        // For now, we prevent editing of giveaways that are still in their "scheduled" phase.
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_SCHEDULED_CANNOT_EDIT'), ephemeral: true });
    }
    if (!giveaway.messageId) { // Should not happen if not ended and not isScheduled, but as a safeguard
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_NOT_ACTIVE_NO_MSG_ID'), ephemeral: true });
    }

    let changesMade = false;
    let embedNeedsUpdate = false;
    let newEndTime = giveaway.endTime;
    let originalEndTimeForLog = giveaway.endTime; // For logging extension accurately

    // --- Apply changes --- 
    const newPrize = interaction.options.getString('new_prize');
    if (newPrize !== null) {
        if (giveaway.prize !== newPrize) {
            giveaway.prize = newPrize;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('prize');
        }
    }

    const newWinners = interaction.options.getInteger('new_winners');
    if (newWinners !== null) {
        if (newWinners < 1) {
            return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_WINNERS_COUNT'), ephemeral: true });
        }
        if (giveaway.winnersCount !== newWinners) {
            giveaway.winnersCount = newWinners;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('winnersCount');
        }
    }

    const extendDurationBy = interaction.options.getString('extend_duration_by');
    if (extendDurationBy !== null) {
        const extendMs = parseDuration(extendDurationBy);
        if (!extendMs || extendMs <= 0) {
            return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_INVALID_EXTENSION_DURATION'), ephemeral: true });
        }
        // newEndTime was already set to giveaway.endTime, so we modify it here
        newEndTime = giveaway.endTime + extendMs;
        if (newEndTime <= Date.now()) {
             return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_EXTENSION_EXPIRED'), ephemeral: true });
        }
        giveaway.endTime = newEndTime;
        changesMade = true; embedNeedsUpdate = true; changedFields.push(`endTime (extended by ${extendDurationBy})`);
    }

    // Single Required Role
    const newRequiredRole = interaction.options.getRole('new_required_role');
    const clearRequiredRole = interaction.options.getBoolean('clear_required_role');
    if (clearRequiredRole) {
        if (giveaway.requiredRoleId !== null) {
            giveaway.requiredRoleId = null;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('requiredRoleId cleared');
        }
    } else if (newRequiredRole) {
        if (giveaway.requiredRoleId !== newRequiredRole.id) {
            giveaway.requiredRoleId = newRequiredRole.id;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('requiredRoleId');
        }
    }
    
    // Required Roles All
    const newRequiredRolesAllStr = interaction.options.getString('new_required_roles_all');
    if (newRequiredRolesAllStr !== null) {
        const newArr = newRequiredRolesAllStr ? newRequiredRolesAllStr.split(',').map(id => id.trim()).filter(id => id) : [];
        if (JSON.stringify(giveaway.requiredRoleIdsAll) !== JSON.stringify(newArr)) {
            giveaway.requiredRoleIdsAll = newArr;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('requiredRoleIdsAll');
        }
    }

    // Blacklisted Roles
    const newBlacklistedRolesStr = interaction.options.getString('new_blacklisted_roles');
    if (newBlacklistedRolesStr !== null) {
        const newArr = newBlacklistedRolesStr ? newBlacklistedRolesStr.split(',').map(id => id.trim()).filter(id => id) : [];
        if (JSON.stringify(giveaway.blacklistedRoleIds) !== JSON.stringify(newArr)) {
            giveaway.blacklistedRoleIds = newArr;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('blacklistedRoleIds');
        }
    }

    // Min Server Duration
    const newMinServerDurationStr = interaction.options.getString('new_min_server_duration');
    if (newMinServerDurationStr !== null) {
        const newMs = newMinServerDurationStr ? (parseDuration(newMinServerDurationStr) || null) : null;
        if (giveaway.minServerDurationMs !== newMs) {
            giveaway.minServerDurationMs = newMs;
            giveaway.minServerDurationStr = newMinServerDurationStr ? (newMinServerDurationStr.trim() || null) : null; 
            changesMade = true; embedNeedsUpdate = true; changedFields.push('minServerDuration');
        }
    }

    // Min Account Duration
    const newMinAccountDurationStr = interaction.options.getString('new_min_account_duration');
    if (newMinAccountDurationStr !== null) {
        const newMs = newMinAccountDurationStr ? (parseDuration(newMinAccountDurationStr) || null) : null;
        if (giveaway.minAccountDurationMs !== newMs) {
            giveaway.minAccountDurationMs = newMs;
            giveaway.minAccountDurationStr = newMinAccountDurationStr ? (newMinAccountDurationStr.trim() || null) : null;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('minAccountDuration');
        }
    }

    // Image URL
    const newImageUrl = interaction.options.getString('new_image_url');
    const clearImageUrl = interaction.options.getBoolean('clear_image_url');
    if (clearImageUrl) {
        if (giveaway.imageUrl !== null) {
            giveaway.imageUrl = null;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('imageUrl cleared');
        }
    } else if (newImageUrl !== null) {
        const val = newImageUrl.trim() === '' ? null : newImageUrl.trim();
        if (giveaway.imageUrl !== val) {
            giveaway.imageUrl = val;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('imageUrl');
        }
    }

    // Embed Color
    const newEmbedColorStr = interaction.options.getString('new_embed_color');
    const clearEmbedColor = interaction.options.getBoolean('clear_embed_color');
    if (clearEmbedColor) {
        if (giveaway.embedColor !== config.DEFAULT_GIVEAWAY_COLOR) {
            giveaway.embedColor = config.DEFAULT_GIVEAWAY_COLOR;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('embedColor cleared');
        }
    } else if (newEmbedColorStr !== null) {
        const val = newEmbedColorStr.trim() === '' ? config.DEFAULT_GIVEAWAY_COLOR : newEmbedColorStr.trim();
        if (giveaway.embedColor !== val) {
            giveaway.embedColor = val;
            changesMade = true; embedNeedsUpdate = true; changedFields.push('embedColor');
        }
    }

    if (!changesMade) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'INFO_NO_CHANGES_MADE'), ephemeral: true });
    }

    // --- Update Timer if endTime changed ---
    if (giveaway.endTime !== originalEndTimeForLog) { // Check if endTime actually changed from its original value
        if (giveawayTimeouts[giveaway.messageId]) {
            clearTimeout(giveawayTimeouts[giveaway.messageId]);
        }
        const newDurationMs = giveaway.endTime - Date.now();
        if (newDurationMs > 0) {
            giveawayTimeouts[giveaway.messageId] = setTimeout(() => {
                giveawayManager.endGiveaway(client, giveaway.messageId, giveaway.channelId, giveaway.guildId, giveawayTimeouts);
            }, newDurationMs);
        } else {
            // End time is in the past or now, end it immediately.
            // This should ideally be caught earlier, but as a fallback.
            process.nextTick(() => giveawayManager.endGiveaway(client, giveaway.messageId, giveaway.channelId, giveaway.guildId, giveawayTimeouts));
        }
    }

    // --- Update Embed ---
    if (embedNeedsUpdate) {
        try {
            const channel = await client.channels.fetch(giveaway.channelId);
            const message = await channel.messages.fetch(giveaway.messageId);
            
            let description = `**${giveaway.prize}**\\n\\n${messageManager.getMessage(guildId, 'GIVEAWAY_ENTER_PROMPT')}`;
            description += messageManager.getMessage(guildId, 'GIVEAWAY_EMBED_TIME_REMAINING', { endTimeTimestamp: Math.floor(giveaway.endTime/1000) });
            description += messageManager.getMessage(guildId, 'GIVEAWAY_EMBED_WINNERS_COUNT', { winnersCount: giveaway.winnersCount });
            description += messageManager.getMessage(guildId, 'GIVEAWAY_EMBED_HOSTED_BY', { hostId: giveaway.hostId });

            if (giveaway.requiredRoleId) {
                description += messageManager.getMessage(guildId, 'GIVEAWAY_EMBED_REQ_ROLE', { roleId: giveaway.requiredRoleId });
            }
            if (giveaway.requiredRoleIdsAll && giveaway.requiredRoleIdsAll.length > 0) {
                const roleMentions = giveaway.requiredRoleIdsAll.map(id => `<@&${id}>`).join(', ');
                description += messageManager.getMessage(guildId, 'GIVEAWAY_EMBED_REQ_ROLES_ALL', { roleMentions });
            }
            if (giveaway.blacklistedRoleIds && giveaway.blacklistedRoleIds.length > 0) {
                const roleMentions = giveaway.blacklistedRoleIds.map(id => `<@&${id}>`).join(', ');
                description += messageManager.getMessage(guildId, 'GIVEAWAY_EMBED_BLACKLIST_ROLES', { roleMentions });
            }
            if (giveaway.minServerDurationMs) {
                description += messageManager.getMessage(guildId, 'GIVEAWAY_EMBED_MIN_SERVER_AGE', { duration: giveaway.minServerDurationStr || msToHuman(giveaway.minServerDurationMs) });
            }
            if (giveaway.minAccountDurationMs) {
                description += messageManager.getMessage(guildId, 'GIVEAWAY_EMBED_MIN_ACCOUNT_AGE', { duration: giveaway.minAccountDurationStr || msToHuman(giveaway.minAccountDurationMs) });
            }

            const updatedEmbed = new EmbedBuilder()
                .setTitle(messageManager.getMessage(guildId, 'GIVEAWAY_START_EMBED_TITLE')) // Or a new GVE_EDITED_TITLE
                .setDescription(description)
                .setColor(giveaway.embedColor || config.DEFAULT_GIVEAWAY_COLOR)
                .setFooter({ text: `${messageManager.getMessage(guildId, 'GIVEAWAY_FOOTER_ENDS_AT')} • ${new Date(giveaway.endTime).toUTCString()}` })
                .setTimestamp(new Date(giveaway.startTime || Date.now())); // Use original start time if available, else now
            
            if (giveaway.imageUrl) {
                updatedEmbed.setImage(giveaway.imageUrl);
            }

            await message.edit({ embeds: [updatedEmbed] });
        } catch (err) {
            console.error('Error updating giveaway message embed after edit:', err);
            await logGiveawayEvent(client, guildId, 'LOG_GIVEAWAY_EDIT_EMBED_FAIL', {
                messageId: giveaway.messageId,
                errorMessage: err.message
            });
            await interaction.followUp({ content: messageManager.getMessage(guildId, 'WARN_GIVEAWAY_EDITED_EMBED_FAIL'), ephemeral: true });
        }
    }

    dataManager.updateGiveaway(giveawayIndex, giveaway);
    await logGiveawayEvent(client, guildId, 'LOG_GIVEAWAY_EDIT_SUCCESS', {
        userId: interaction.user.id,
        messageId: giveaway.messageId,
        changesSummaryString: changedFields.length > 0 ? changedFields.join(', ') : 'No effective changes applied'
    });
    
    // Use followUp if reply was already sent for no changes, otherwise reply.
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: messageManager.getMessage(guildId, 'GIVEAWAY_EDITED_SUCCESS'), ephemeral: true });
    } else {
        await interaction.reply({ content: messageManager.getMessage(guildId, 'GIVEAWAY_EDITED_SUCCESS'), ephemeral: true });
    }
}; 