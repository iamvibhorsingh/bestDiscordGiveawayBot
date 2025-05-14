const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const messageManager = require('../../messageManager');

module.exports = async function handleCustomizeMessage(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: messageManager.getMessage(interaction.guildId, 'ERROR_PERMISSION_MANAGE_GUILD'), ephemeral: true });
    }

    const subCommandGroup = interaction.options.getSubcommandGroup();
    const subCommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (subCommandGroup !== 'customizemessage') {
        console.warn(`[CustomizeMessage] Incorrect subcommand group received: ${subCommandGroup}`);
        return interaction.reply({ content: 'Internal command routing error.', ephemeral: true });
    }

    switch (subCommand) {
        case 'set': {
            const key = interaction.options.getString('key');
            const text = interaction.options.getString('text');
            if (!messageManager.defaultMessages[key]) {
                return interaction.reply({ content: `❌ Invalid message key: \`\`\`${key}\`\`\`. Use \`/giveawayutil customizemessage listkeys\` to see available keys.`, ephemeral: true });
            }
            messageManager.setCustomMessage(guildId, key, text);
            // Corrected reply for 'set' to avoid problematic characters for the tool
            return interaction.reply({ content: `Custom message for '${key}' has been set.`, ephemeral: true });
        }
        case 'view': {
            const key = interaction.options.getString('key');
            if (!messageManager.defaultMessages[key]) {
                return interaction.reply({ content: `❌ Invalid message key: \`\`\`${key}\`\`\`. Use \`/giveawayutil customizemessage listkeys\` to see available keys.`, ephemeral: true });
            }
            const customMessage = messageManager.getCustomMessage(guildId, key);
            const defaultMessage = messageManager.defaultMessages[key];
            
            const examplePlaceholders = { prize: "TestPrize", winnerMentions: "@Winner", durationStr: "1h", startTime: "tomorrow", logChannel: "#testlogs", userId: "testUser" };
            const liveMessagePreview = messageManager.getMessage(guildId, key, examplePlaceholders);

            const embed = new EmbedBuilder()
                .setTitle(`Message Preview: ${key}`)
                .setColor(customMessage ? '#00FF00' : '#FFFF00')
                .addFields(
                    { name: 'Current (Live) Message Preview', value: `\`\`\`${liveMessagePreview.substring(0, 1000)}\`\`\`\\n*(Placeholders filled with examples.)*` },
                    { name: 'Custom Setting', value: customMessage ? `\`\`\`${customMessage.substring(0,1000)}\`\`\`` : 'Not set (using default)' },
                    { name: 'Default Value', value: `\`\`\`${defaultMessage.substring(0,1000)}\`\`\`` }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        case 'reset': {
            const key = interaction.options.getString('key');
            if (!messageManager.defaultMessages[key]) {
                return interaction.reply({ content: `❌ Invalid message key: \`\`\`${key}\`\`\`. Use \`/giveawayutil customizemessage listkeys\` to see available keys.`, ephemeral: true });
            }
            if (messageManager.resetCustomMessage(guildId, key)) {
                return interaction.reply({ content: `Custom message for \`\`\`${key}\`\`\` has been reset.`, ephemeral: true });
            } else {
                return interaction.reply({ content: `No custom message for \`\`\`${key}\`\`\`. It is already default.`, ephemeral: true });
            }
        }
        case 'listkeys': {
            const allKeys = messageManager.getAllMessageKeys();
            const MAX_KEYS_PER_EMBED = 20;
            const embeds = [];
            let currentDescription = "";

            for (let i = 0; i < allKeys.length; i++) {
                const keyString = `\`${allKeys[i]}\`\\n`;
                if ((currentDescription + keyString).length > 4000) { // Check Discord description limit
                    embeds.push(new EmbedBuilder().setTitle(embeds.length === 0 ? 'Available Message Keys' : 'Available Message Keys (Cont.)').setDescription(currentDescription).setColor('#0099ff'));
                    currentDescription = "";
                }
                currentDescription += keyString;
            }
            if (currentDescription.length > 0) {
                 embeds.push(new EmbedBuilder().setTitle(embeds.length === 0 ? 'Available Message Keys' : 'Available Message Keys (Cont.)').setDescription(currentDescription).setColor('#0099ff').setFooter({text: `Use keys with /giveawayutil customizemessage <set|view|reset>`}));
            }
            
            if (embeds.length === 0) {
                 return interaction.reply({ content: "No message keys found.", ephemeral: true});
            }

            return interaction.reply({ embeds: embeds.slice(0, 10), ephemeral: true }); // Discord allows max 10 embeds per message
        }
        default:
            return interaction.reply({ content: 'Unknown subcommand for customizemessage.', ephemeral: true });
    }
}; 