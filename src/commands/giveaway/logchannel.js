const { PermissionFlagsBits } = require('discord.js');
const { logGiveawayEvent } = require('../../utils/logger');
const dataManager = require('../../dataManager');
const messageManager = require('../../messageManager');

module.exports = async function handleLogChannel(interaction, client) {
    // Permission check should ideally be here or handled globally for subcommands
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: messageManager.getMessage(interaction.guildId, 'ERROR_PERMISSION_LOG_CHANNEL'), ephemeral: true });
    }

    const logChannel = interaction.options.getChannel('channel');

    if (logChannel) {
        if (logChannel.type !== 0) { // GUILD_TEXT
            return interaction.reply({ content: messageManager.getMessage(interaction.guildId, 'ERROR_INVALID_LOG_CHANNEL_TYPE'), ephemeral: true });
        }
        dataManager.setLogChannelForGuild(interaction.guildId, logChannel.id);
        await interaction.reply({ content: messageManager.getMessage(interaction.guildId, 'LOG_CHANNEL_SET', { logChannel: logChannel.toString() }), ephemeral: true });
        await logGiveawayEvent(client, interaction.guildId, 'LOG_CHANNEL_SET_LOG', { channelId: logChannel.id, userId: interaction.user.id });
    } else {
        dataManager.deleteLogChannelForGuild(interaction.guildId);
        await interaction.reply({ content: messageManager.getMessage(interaction.guildId, 'LOG_CHANNEL_CLEARED'), ephemeral: true });
        await logGiveawayEvent(client, interaction.guildId, 'LOG_CHANNEL_CLEARED_LOG', { userId: interaction.user.id });
    }
}; 