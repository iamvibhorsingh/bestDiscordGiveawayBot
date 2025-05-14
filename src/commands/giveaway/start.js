const { EmbedBuilder } = require('discord.js');
const { parseDuration } = require('../../utils/timeUtils');
const { logGiveawayEvent } = require('../../utils/logger');
const dataManager = require('../../dataManager');
const config = require('../../config');
const giveawayManager = require('../../core/giveawayManager');
const messageManager = require('../../messageManager');

module.exports = async function handleStart(interaction, client, giveawayTimeouts) {
    const guildId = interaction.guildId;
    const durationStr = interaction.options.getString('duration');
    const winnersCount = interaction.options.getInteger('winners');
    const prize = interaction.options.getString('prize');
    const requiredRole = interaction.options.getRole('required_role');
    const imageUrl = interaction.options.getString('image_url');
    const embedColor = interaction.options.getString('embed_color') || config.DEFAULT_GIVEAWAY_COLOR;

    // New options for advanced entry requirements
    const requiredRolesAllStr = interaction.options.getString('required_roles_all');
    const blacklistedRolesStr = interaction.options.getString('blacklisted_roles');
    const minServerDurationStr = interaction.options.getString('min_server_duration');
    const minAccountDurationStr = interaction.options.getString('min_account_duration');

    const requiredRoleIdsAll = requiredRolesAllStr ? requiredRolesAllStr.split(',').map(id => id.trim()).filter(id => id) : [];
    const blacklistedRoleIds = blacklistedRolesStr ? blacklistedRolesStr.split(',').map(id => id.trim()).filter(id => id) : [];
    const minServerDurationMs = minServerDurationStr ? parseDuration(minServerDurationStr) : null;
    const minAccountDurationMs = minAccountDurationStr ? parseDuration(minAccountDurationStr) : null;

    await logGiveawayEvent(client, guildId, 'LOG_GIVEAWAY_START_ATTEMPT', {
        userId: interaction.user.id,
        prize: prize,
        duration: durationStr,
        winnersCount: winnersCount,
        roleId: requiredRole ? requiredRole.id : 'none',
        requiredRolesAll: requiredRoleIdsAll.join(', ') || 'none',
        blacklistedRoles: blacklistedRoleIds.join(', ') || 'none',
        minServerDuration: minServerDurationStr || 'none',
        minAccountDuration: minAccountDurationStr || 'none'
    });

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_INVALID_DURATION'), ephemeral: true });
    }
    if (winnersCount < 1) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_WINNERS_COUNT'), ephemeral: true });
    }

    const endTime = Date.now() + durationMs;
    let description = `**${prize}**\\n\\n${messageManager.getMessage(guildId, 'GIVEAWAY_ENTER_PROMPT')}\\nTime remaining: <t:${Math.floor(endTime/1000)}:R>\\nWinners: ${winnersCount}\\nHosted by: <@${interaction.user.id}>`;

    if (requiredRole) {
        description += `\\nRequired role: <@&${requiredRole.id}>`;
    }
    if (requiredRoleIdsAll.length > 0) {
        description += `\\nMust have ALL roles: ${requiredRoleIdsAll.map(id => `<@&${id}>`).join(', ')}`;
    }
    if (blacklistedRoleIds.length > 0) {
        description += `\\nMust NOT have roles: ${blacklistedRoleIds.map(id => `<@&${id}>`).join(', ')}`;
    }
    if (minServerDurationStr && minServerDurationMs) {
        description += `\\nMin. server membership: ${minServerDurationStr}`;
    }
    if (minAccountDurationStr && minAccountDurationMs) {
        description += `\\nMin. account age: ${minAccountDurationStr}`;
    }

    const giveawayEmbed = new EmbedBuilder()
        .setTitle(messageManager.getMessage(guildId, 'GIVEAWAY_START_EMBED_TITLE'))
        .setDescription(description)
        .setColor(embedColor)
        .setFooter({ text: `${messageManager.getMessage(guildId, 'GIVEAWAY_FOOTER_ENDS_AT')} • ${new Date(endTime).toUTCString()}` })
        .setTimestamp();

    if (imageUrl) {
        giveawayEmbed.setImage(imageUrl);
    }
    
    await interaction.reply({ content: messageManager.getMessage(guildId, 'GIVEAWAY_CREATED_EPHEMERAL', { prize: prize }), ephemeral: true });

    const giveawayMessage = await interaction.channel.send({ embeds: [giveawayEmbed] });
    await giveawayMessage.react('🎁');

    const giveawayData = {
        messageId: giveawayMessage.id,
        channelId: interaction.channelId,
        guildId: guildId,
        prize,
        winnersCount,
        endTime,
        hostId: interaction.user.id,
        requiredRoleId: requiredRole ? requiredRole.id : null,
        ended: false,
        isScheduled: false,
        imageUrl: imageUrl,
        embedColor: embedColor,
        // New fields for advanced requirements
        requiredRoleIdsAll: requiredRoleIdsAll,
        blacklistedRoleIds: blacklistedRoleIds,
        minServerDurationMs: minServerDurationMs,
        minAccountDurationMs: minAccountDurationMs,
        // Store original duration string for display if needed later, though msToHuman can also be used
        durationStr: durationStr 
    };

    dataManager.addGiveaway(giveawayData);
    await logGiveawayEvent(client, guildId, 'LOG_GIVEAWAY_STARTED', {
        prize: prize,
        messageId: giveawayMessage.id,
        userId: interaction.user.id,
        durationStr: durationStr
    });

    giveawayTimeouts[giveawayMessage.id] = setTimeout(() => {
        giveawayManager.endGiveaway(client, giveawayMessage.id, interaction.channelId, guildId, giveawayTimeouts);
    }, durationMs);
}; 