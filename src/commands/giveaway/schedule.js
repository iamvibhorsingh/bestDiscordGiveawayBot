const { parseDuration } = require('../../utils/timeUtils');
const { logGiveawayEvent } = require('../../utils/logger');
const dataManager = require('../../dataManager');
const config = require('../../config');
const giveawayManager = require('../../core/giveawayManager');
const messageManager = require('../../messageManager');

module.exports = async function handleSchedule(interaction, client, giveawayTimeouts) {
    const guildId = interaction.guildId;
    const startInStr = interaction.options.getString('start_in');
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

    await logGiveawayEvent(client, guildId, 'LOG_GIVEAWAY_SCHEDULE_ATTEMPT', {
        userId: interaction.user.id,
        prize: prize,
        startIn: startInStr,
        duration: durationStr,
        winnersCount: winnersCount,
        roleId: requiredRole ? requiredRole.id : 'none',
        requiredRolesAll: requiredRoleIdsAll.join(', ') || 'none',
        blacklistedRoles: blacklistedRoleIds.join(', ') || 'none',
        minServerDuration: minServerDurationStr || 'none',
        minAccountDuration: minAccountDurationStr || 'none'
    });

    const startInMs = parseDuration(startInStr);
    const durationMs = parseDuration(durationStr);

    if (!startInMs || startInMs <= 0) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_INVALID_START_TIME'), ephemeral: true });
    }
    if (!durationMs || durationMs <= 0) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_INVALID_DURATION'), ephemeral: true });
    }
    if (winnersCount < 1) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_WINNERS_COUNT'), ephemeral: true });
    }

    const startTime = Date.now() + startInMs;
    const actualEndTime = startTime + durationMs;
    const scheduleId = `scheduled_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const giveawayData = {
        scheduleId,
        channelId: interaction.channelId,
        guildId: guildId,
        prize,
        winnersCount,
        hostId: interaction.user.id,
        requiredRoleId: requiredRole ? requiredRole.id : null,
        isScheduled: true,
        startTime,
        durationMs, // Store durationMs to use when starting
        endTime: actualEndTime, // Store final end time
        imageUrl,
        embedColor,
        ended: false,
        messageId: null, // Will be set when giveaway starts
        // New fields for advanced requirements
        requiredRoleIdsAll: requiredRoleIdsAll,
        blacklistedRoleIds: blacklistedRoleIds,
        minServerDurationMs: minServerDurationMs,
        minAccountDurationMs: minAccountDurationMs,
        durationStr: durationStr, // Store for consistent display
        startInStr: startInStr // Store for consistent display
    };

    dataManager.addGiveaway(giveawayData);

    giveawayTimeouts[scheduleId] = setTimeout(() => {
        giveawayManager.initiateScheduledGiveaway(client, scheduleId, giveawayTimeouts);
    }, startInMs);

    await interaction.reply({ content: messageManager.getMessage(guildId, 'GIVEAWAY_SCHEDULED_EPHEMERAL', { prize: prize, startTime: Math.floor(startTime/1000), durationStr: durationStr }), ephemeral: true });
    await logGiveawayEvent(client, guildId, 'LOG_GIVEAWAY_SCHEDULED', {
        prize: prize,
        userId: interaction.user.id,
        scheduleId: scheduleId,
        startInStr: startInStr,
        durationStr: durationStr
    });
    console.log(`Giveaway scheduled: scheduleId=${scheduleId}, prize=${prize}, startTime=${new Date(startTime).toISOString()}, duration=${durationStr}`);
}; 