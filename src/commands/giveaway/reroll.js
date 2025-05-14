const { logGiveawayEvent } = require('../../utils/logger');
const dataManager = require('../../dataManager');
const giveawayManager = require('../../core/giveawayManager');
const messageManager = require('../../messageManager');

module.exports = async function handleReroll(interaction, client) {
    const guildId = interaction.guildId;
    const messageId = interaction.options.getString('message_id');
    const newWinnersCountOpt = interaction.options.getInteger('winners');

    const giveaway = dataManager.getGiveaways().find(g => g.messageId === messageId && g.guildId === guildId);

    await logGiveawayEvent(client, guildId, 'LOG_REROLL_ATTEMPT', {
        userId: interaction.user.id,
        messageId: messageId,
        newWinnersCount: newWinnersCountOpt || (giveaway ? giveaway.winnersCount : 'N/A')
    });    

    if (!giveaway) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_NOT_FOUND'), ephemeral: true });
    }
    if (!giveaway.ended) {
        return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_NOT_ENDED_YET'), ephemeral: true });
    }
    if (giveaway.isScheduled) {
         return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_GIVEAWAY_SCHEDULED_NO_REROLL'), ephemeral: true });
    }

    const newWinnersCount = newWinnersCountOpt || giveaway.winnersCount;

    await interaction.reply({ content: messageManager.getMessage(guildId, 'GIVEAWAY_REROLLING_EPHEMERAL'), ephemeral: true });

    const result = await giveawayManager.rerollGiveaway(client, messageId, giveaway.channelId, guildId, newWinnersCount);

    if (result.success) {
        console.log(`Reroll successful for giveaway ${messageId} by user ${interaction.user.id}`);
        await logGiveawayEvent(client, guildId, 'LOG_REROLL_SUCCESS', {
            prize: giveaway.prize,
            messageId: messageId,
            userId: interaction.user.id,
            newWinnersCount: newWinnersCount,
            resultMessage: result.message
        });
    } else {
        await interaction.followUp({ content: result.message, ephemeral: true }); // result.message is already formatted by messageManager in core
        await logGiveawayEvent(client, guildId, 'LOG_REROLL_FAILED', {
            prize: giveaway.prize,
            messageId: messageId,
            userId: interaction.user.id,
            reason: result.message
        });
    }
}; 