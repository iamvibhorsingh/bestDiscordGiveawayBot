const { logGiveawayEvent } = require('../../utils/logger');
const dataManager = require('../../dataManager');
const giveawayManager = require('../../core/giveawayManager');
const messageManager = require('../../messageManager');

module.exports = async function handleEnd(interaction, client, giveawayTimeouts) {
    const guildId = interaction.guildId;
    const messageId = interaction.options.getString('message_id');
    
    await logGiveawayEvent(client, guildId, 'LOG_MANUAL_END_ATTEMPT', {
        userId: interaction.user.id,
        messageId: messageId
    });

    const giveaway = dataManager.getGiveaways().find(g => g.messageId === messageId && g.guildId === guildId);

    if (!giveaway) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_NOT_FOUND'), ephemeral: true });
    }
    if (giveaway.ended) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_ALREADY_ENDED'), ephemeral: true });
    }
    if (giveaway.isScheduled) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_SCHEDULED_NO_END'), ephemeral: true });
    }

    await interaction.reply({ content: messageManager.getMessage(guildId, 'GIVEAWAY_ENDING_EPHEMERAL'), ephemeral: true });
    await giveawayManager.endGiveaway(client, messageId, giveaway.channelId, giveaway.guildId, giveawayTimeouts);
    await logGiveawayEvent(client, guildId, 'LOG_MANUAL_END_SUCCESS', {
        prize: giveaway.prize,
        messageId: messageId,
        userId: interaction.user.id
    });
}; 