const { PermissionFlagsBits } = require('discord.js');
const dataManager = require('../../dataManager');
const messageManager = require('../../messageManager');
const { logGiveawayEvent } = require('../../utils/logger');

module.exports = async function handleSetCreatorRole(interaction, client) {
    const guildId = interaction.guildId;
    const memberPermissions = interaction.member.permissions;

    // Permission check: Only users with Manage Server or Administrator can use these commands
    if (!memberPermissions.has(PermissionFlagsBits.ManageGuild) && !memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: messageManager.getMessage(guildId, 'ERROR_PERMISSION_MANAGE_CREATOR_ROLES'),
            ephemeral: true
        });
    }

    const subCommand = interaction.options.getSubcommand();

    switch (subCommand) {
        case 'add': {
            const role = interaction.options.getRole('role');
            const added = dataManager.addCreatorRole(guildId, role.id);
            if (added) {
                await logGiveawayEvent(client, guildId, 'LOG_CREATOR_ROLE_ADD_SUCCESS', { userId: interaction.user.id, roleName: role.name, roleId: role.id });
                return interaction.reply({ content: messageManager.getMessage(guildId, 'CREATOR_ROLE_ADDED', { roleName: role.name, roleId: role.id }), ephemeral: true });
            } else {
                await logGiveawayEvent(client, guildId, 'LOG_CREATOR_ROLE_ADD_FAIL_EXISTS', { userId: interaction.user.id, roleName: role.name, roleId: role.id });
                return interaction.reply({ content: messageManager.getMessage(guildId, 'CREATOR_ROLE_ALREADY_EXISTS', { roleName: role.name, roleId: role.id }), ephemeral: true });
            }
        }
        case 'remove': {
            const role = interaction.options.getRole('role');
            const removed = dataManager.removeCreatorRole(guildId, role.id);
            if (removed) {
                await logGiveawayEvent(client, guildId, 'LOG_CREATOR_ROLE_REMOVE_SUCCESS', { userId: interaction.user.id, roleName: role.name, roleId: role.id });
                return interaction.reply({ content: messageManager.getMessage(guildId, 'CREATOR_ROLE_REMOVED', { roleName: role.name, roleId: role.id }), ephemeral: true });
            } else {
                await logGiveawayEvent(client, guildId, 'LOG_CREATOR_ROLE_REMOVE_FAIL_NOT_FOUND', { userId: interaction.user.id, roleName: role.name, roleId: role.id });
                return interaction.reply({ content: messageManager.getMessage(guildId, 'CREATOR_ROLE_NOT_FOUND_FOR_REMOVE', { roleName: role.name, roleId: role.id }), ephemeral: true });
            }
        }
        case 'list': {
            const creatorRolesIds = dataManager.getCreatorRoles(guildId);
            let response;
            let roleListStringOrEmpty = 'None';
            if (creatorRolesIds.length === 0) {
                response = messageManager.getMessage(guildId, 'CREATOR_ROLES_LIST_EMPTY');
            } else {
                const roleMentions = creatorRolesIds.map(id => `<@&${id}> (${id})`).join('\n');
                roleListStringOrEmpty = roleMentions;
                response = messageManager.getMessage(guildId, 'CREATOR_ROLES_LIST', { roleListString: roleMentions });
            }
            await logGiveawayEvent(client, guildId, 'LOG_CREATOR_ROLES_VIEWED', { userId: interaction.user.id, roleListStringOrEmpty });
            return interaction.reply({ content: response, ephemeral: true });
        }
        default:
            return interaction.reply({ content: 'Unknown setcreatorrole command.', ephemeral: true });
    }
}; 