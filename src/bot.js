const { Client, GatewayIntentBits, Partials, PermissionFlagsBits } = require('discord.js');
const dataManager = require('./dataManager');
const { registerCommands } = require('./commands/register');
const { logGiveawayEvent } = require('./utils/logger');
const giveawayManager = require('./core/giveawayManager');
const messageManager = require('./messageManager');

// Command handlers
const handleStart = require('./commands/giveaway/start');
const handleSchedule = require('./commands/giveaway/schedule');
const handleEnd = require('./commands/giveaway/end');
const handleReroll = require('./commands/giveaway/reroll');
const handleLogChannel = require('./commands/giveaway/logchannel');
const handleEdit = require('./commands/giveaway/edit');
// New handler for customizemessage
const handleCustomizeMessage = require('./commands/giveawayutil/customizemessage');
const handleSetCreatorRole = require('./commands/giveawayutil/setcreatorrole.js');

// Create client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Store active giveaway timeouts (messageId/scheduleId -> timeoutId)
let giveawayTimeouts = {};

// Load data
dataManager.loadGiveaways();
dataManager.loadLogChannels();
messageManager.loadCustomMessages();
dataManager.loadGiveawayCreatorRoles();

function restartGiveawayTimers() {
    const giveaways = dataManager.getGiveaways();
    const now = Date.now();
    console.log(`Restarting timers for ${giveaways.length} loaded giveaways...`);

    giveaways.forEach(giveaway => {
        if (giveaway.isScheduled && giveaway.scheduleId) {
            const timeToStart = giveaway.startTime - now;
            if (timeToStart > 0) {
                console.log(`Rescheduling giveaway ${giveaway.prize} (Schedule ID: ${giveaway.scheduleId}) to start in ${timeToStart}ms.`);
                if (giveawayTimeouts[giveaway.scheduleId]) clearTimeout(giveawayTimeouts[giveaway.scheduleId]);
                giveawayTimeouts[giveaway.scheduleId] = setTimeout(() => giveawayManager.initiateScheduledGiveaway(client, giveaway.scheduleId, giveawayTimeouts), timeToStart);
            } else if (!giveaway.ended) {
                // Should have started while offline
                console.log(`Giveaway ${giveaway.prize} (Schedule ID: ${giveaway.scheduleId}) should have started while offline. Initiating now.`);
                process.nextTick(() => giveawayManager.initiateScheduledGiveaway(client, giveaway.scheduleId, giveawayTimeouts));
            }
        } else if (!giveaway.ended && giveaway.messageId) {
            const timeLeft = giveaway.endTime - now;
            if (timeLeft > 0) {
                console.log(`Restarting timer for active giveaway ${giveaway.messageId} ('${giveaway.prize}') with ${timeLeft}ms left.`);
                if (giveawayTimeouts[giveaway.messageId]) clearTimeout(giveawayTimeouts[giveaway.messageId]);
                giveawayTimeouts[giveaway.messageId] = setTimeout(() => giveawayManager.endGiveaway(client, giveaway.messageId, giveaway.channelId, giveaway.guildId, giveawayTimeouts), timeLeft);
            } else {
                // Should have ended while offline
                console.log(`Active giveaway ${giveaway.messageId} ('${giveaway.prize}') should have ended while offline. Processing end now.`);
                // Ensure it's not already marked ended from a previous failed attempt during this startup
                const currentGiveawayState = dataManager.findGiveaway(giveaway.messageId);
                if (currentGiveawayState && !currentGiveawayState.ended) {
                    process.nextTick(() => giveawayManager.endGiveaway(client, giveaway.messageId, giveaway.channelId, giveaway.guildId, giveawayTimeouts));
                }
            }
        }
    });
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('/giveaway start', { type: 'PLAYING' });
  await registerCommands(client); // Register commands globally on ready
  restartGiveawayTimers();
  logGiveawayEvent(client, 'GLOBAL', 'LOG_BOT_READY', { giveawaysLoadedCount: dataManager.getGiveaways().length });
});

// Register slash commands when added to a new guild
client.on('guildCreate', async (guild) => {
  console.log(`Joined new guild: ${guild.name} (${guild.id})`);
  await registerCommands(client, guild.id);
  await logGiveawayEvent(client, guild.id, 'LOG_BOT_JOINED_GUILD', { guildName: guild.name });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand() && !interaction.isAutocomplete()) return;

  const { commandName } = interaction;

  if (commandName === 'giveaway') {
    const subCommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId; // Get guildId here for use in permission checks
    const member = interaction.member; // Get member for role checks

    console.log(`Received giveaway subcommand: ${subCommand} by ${interaction.user.tag} in ${guildId}`);

    // Specific permission logic for giveaway creation commands
    if (subCommand === 'start' || subCommand === 'schedule') {
        const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild) || member.permissions.has(PermissionFlagsBits.Administrator);
        const creatorRoles = dataManager.getCreatorRoles(guildId);
        let canCreate = isAdmin; // Admins can always create

        if (!isAdmin && creatorRoles.length > 0) {
            // If not admin and creator roles are set, check if user has one of them
            canCreate = creatorRoles.some(roleId => member.roles.cache.has(roleId));
        } else if (!isAdmin && creatorRoles.length === 0) {
            // If not admin and no creator roles are set, only admins can create (so canCreate remains false)
            canCreate = false;
        }
        // If creatorRoles is empty, canCreate defaults to isAdmin. 
        // If isAdmin is true, they can create. 
        // If isAdmin is false (and creatorRoles is empty), they cannot create.

        if (!canCreate) {
            console.log(`User ${interaction.user.tag} lacks permission/role for /giveaway ${subCommand}.`);
            return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_NO_PERMISSION_TO_CREATE_GIVEAWAY'), ephemeral: true });
        }
    } else {
        // Centralized permission check for other giveaway commands (edit, end, reroll)
        const requiresManageGuild = !['logchannel'].includes(subCommand); 
        if (requiresManageGuild && !member.permissions.has(PermissionFlagsBits.ManageGuild) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            console.log(`User ${interaction.user.tag} lacks ManageGuild permission for /giveaway ${subCommand}.`);
            return interaction.reply({ content: messageManager.getMessage(guildId, 'ERROR_PERMISSION_MANAGE_GUILD'), ephemeral: true });
        }
    }

    try {
        switch (subCommand) {
            case 'start':
                await handleStart(interaction, client, giveawayTimeouts);
                break;
            case 'schedule':
                await handleSchedule(interaction, client, giveawayTimeouts);
                break;
            case 'end':
                await handleEnd(interaction, client, giveawayTimeouts);
                break;
            case 'reroll':
                await handleReroll(interaction, client); // giveawayTimeouts not directly needed by reroll handler
                break;
            case 'edit':
                await handleEdit(interaction, client, giveawayTimeouts);
                break;
            case 'logchannel':
                await handleLogChannel(interaction, client);
                break;
            default:
                await interaction.reply({ content: 'Unknown giveaway command.', ephemeral: true });
        }
    } catch (error) {
        console.error(`Error handling /giveaway ${subCommand}:`, error);
        await logGiveawayEvent(client, interaction.guildId, 'LOG_SLASH_COMMAND_ERROR', { commandName: 'giveaway', subCommandPlaceholder: subCommand ? `${subCommand} ` : '', userId: interaction.user.id, errorMessage: error.message });
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'An error occurred while executing this command.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    }
  } else if (commandName === 'giveawayutil') {
    const subCommandGroup = interaction.options.getSubcommandGroup();
    if (subCommandGroup === 'customizemessage') {
        try {
            await handleCustomizeMessage(interaction, client);
        } catch (error) {
            console.error(`Error handling /giveawayutil customizemessage:`, error);
            await logGiveawayEvent(client, interaction.guildId, 'LOG_SLASH_COMMAND_ERROR', { commandName: 'giveawayutil customizemessage', subCommandPlaceholder: '', userId: interaction.user.id, errorMessage: error.message });
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: messageManager.getMessage(interaction.guildId, 'ERROR_COMMAND_EXECUTION'), ephemeral: true });
            } else {
                await interaction.reply({ content: messageManager.getMessage(interaction.guildId, 'ERROR_COMMAND_EXECUTION'), ephemeral: true });
            }
        }
    } else if (subCommandGroup === 'setcreatorrole') {
        try {
            await handleSetCreatorRole(interaction, client);
        } catch (error) {
            console.error(`Error handling /giveawayutil setcreatorrole:`, error);
            await logGiveawayEvent(client, interaction.guildId, 'LOG_SLASH_COMMAND_ERROR', { commandName: 'giveawayutil setcreatorrole', subCommandPlaceholder: '', userId: interaction.user.id, errorMessage: error.message });
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: messageManager.getMessage(interaction.guildId, 'ERROR_COMMAND_EXECUTION'), ephemeral: true });
            } else {
                await interaction.reply({ content: messageManager.getMessage(interaction.guildId, 'ERROR_COMMAND_EXECUTION'), ephemeral: true });
            }
        }
    } else {
        await interaction.reply({ content: 'Unknown giveawayutil command group.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN); 