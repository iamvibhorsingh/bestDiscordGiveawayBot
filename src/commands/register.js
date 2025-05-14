const { PermissionFlagsBits } = require('discord.js');

const commands = [
    {
      name: 'giveaway',
      description: 'Giveaway commands',
      options: [
        {
          name: 'start',
          description: 'Start a new giveaway immediately',
          type: 1, // SUB_COMMAND
          options: [
            {
              name: 'duration',
              description: 'Duration of the giveaway (e.g. 1d, 12h, 30m)',
              type: 3, // STRING
              required: true
            },
            {
              name: 'winners',
              description: 'Number of winners',
              type: 4, // INTEGER
              required: true
            },
            {
              name: 'prize',
              description: 'What are you giving away?',
              type: 3, // STRING
              required: true
            },
            {
              name: 'required_role',
              description: 'Role required to enter (optional, user must have this one role)',
              type: 8, // ROLE
              required: false
            },
            {
              name: 'required_roles_all',
              description: 'Comma-separated IDs of roles a user must have ALL of (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'blacklisted_roles',
              description: 'Comma-separated IDs of roles a user must NOT have (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'min_server_duration',
              description: 'Min time in server to enter (e.g., 7d, 1M) (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'min_account_duration',
              description: 'Min Discord account age to enter (e.g., 30d, 3M) (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'image_url',
              description: 'Image URL for the giveaway embed (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'embed_color',
              description: 'Hex color for the giveaway embed (optional, e.g. #FF0000)',
              type: 3, // STRING
              required: false
            }
          ]
        },
        {
          name: 'schedule',
          description: 'Schedule a giveaway to start at a future time',
          type: 1, // SUB_COMMAND
          options: [
            {
              name: 'start_in',
              description: 'When the giveaway should start (e.g., 1h, 30m, 1d12h)',
              type: 3, // STRING
              required: true
            },
            {
              name: 'duration',
              description: 'Duration of the giveaway (e.g. 1d, 12h, 30m)',
              type: 3, // STRING
              required: true
            },
            {
              name: 'winners',
              description: 'Number of winners',
              type: 4, // INTEGER
              required: true
            },
            {
              name: 'prize',
              description: 'What are you giving away?',
              type: 3, // STRING
              required: true
            },
            {
              name: 'required_role',
              description: 'Role required to enter (optional, user must have this one role)',
              type: 8, // ROLE
              required: false
            },
            {
              name: 'required_roles_all',
              description: 'Comma-separated IDs of roles a user must have ALL of (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'blacklisted_roles',
              description: 'Comma-separated IDs of roles a user must NOT have (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'min_server_duration',
              description: 'Min time in server to enter (e.g., 7d, 1M) (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'min_account_duration',
              description: 'Min Discord account age to enter (e.g., 30d, 3M) (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'image_url',
              description: 'Image URL for the giveaway embed (optional)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'embed_color',
              description: 'Hex color for the giveaway embed (optional, e.g. #FF0000)',
              type: 3, // STRING
              required: false
            }
          ]
        },
        {
          name: 'end',
          description: 'End a giveaway early',
          type: 1, // SUB_COMMAND
          options: [
            {
              name: 'message_id',
              description: 'The message ID of the giveaway',
              type: 3, // STRING
              required: true
            }
          ]
        },
        {
          name: 'reroll',
          description: 'Reroll winners for a giveaway',
          type: 1, // SUB_COMMAND
          options: [
            {
              name: 'message_id',
              description: 'The message ID of the giveaway',
              type: 3, // STRING
              required: true
            },
            {
              name: 'winners',
              description: 'Number of winners to reroll (optional)',
              type: 4, // INTEGER
              required: false
            }
          ]
        },
        {
          name: 'edit',
          description: 'Edit an active giveaway',
          type: 1, // SUB_COMMAND
          options: [
            {
              name: 'message_id',
              description: 'The message ID of the giveaway to edit',
              type: 3, // STRING
              required: true
            },
            {
              name: 'new_prize',
              description: 'New prize for the giveaway',
              type: 3, // STRING
              required: false
            },
            {
              name: 'new_winners',
              description: 'New number of winners (min 1)',
              type: 4, // INTEGER
              required: false,
              min_value: 1
            },
            {
              name: 'extend_duration_by',
              description: 'Extend giveaway duration by (e.g., 1h, 30m). Does not shorten.',
              type: 3, // STRING
              required: false
            },
            {
              name: 'new_required_role',
              description: 'New single role requirement',
              type: 8, // ROLE
              required: false
            },
            {
              name: 'clear_required_role',
              description: 'Set to true to remove the single role requirement',
              type: 5, // BOOLEAN
              required: false
            },
            {
              name: 'new_required_roles_all',
              description: 'New comma-separated IDs for "must have ALL" roles (empty to clear)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'new_blacklisted_roles',
              description: 'New comma-separated IDs for "must NOT have" roles (empty to clear)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'new_min_server_duration',
              description: 'New min server membership (e.g., 7d, 1M; 0m or empty to clear)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'new_min_account_duration',
              description: 'New min account age (e.g., 30d, 3M; 0m or empty to clear)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'new_image_url',
              description: 'New image URL for the embed',
              type: 3, // STRING
              required: false
            },
            {
              name: 'clear_image_url',
              description: 'Set to true to remove the image URL',
              type: 5, // BOOLEAN
              required: false
            },
            {
              name: 'new_embed_color',
              description: 'New hex color for the embed (e.g. #FF0000)',
              type: 3, // STRING
              required: false
            },
            {
              name: 'clear_embed_color',
              description: 'Set to true to reset embed color to default',
              type: 5, // BOOLEAN
              required: false
            }
          ]
        },
        {
            name: 'logchannel',
            description: 'Set or clear the giveaway log channel',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: 'channel',
                    description: 'The text channel to send logs to (leave blank to clear)',
                    type: 7, // CHANNEL
                    required: false,
                    channel_types: [0] // Text channel
                }
            ]
        }
      ]
    },
    {
        name: 'giveawayutil',
        description: 'Utility commands for giveaways',
        options: [
            {
                name: 'customizemessage',
                description: 'Manage customizable bot messages for giveaways',
                type: 2, // SUB_COMMAND_GROUP
                options: [
                    {
                        name: 'set',
                        description: 'Set a custom message for a specific event/key.',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'key',
                                description: 'The message key to customize (use \'listkeys\' to see all).',
                                type: 3, // STRING
                                required: true,
                                autocomplete: true // Add autocomplete later if possible
                            },
                            {
                                name: 'text',
                                description: 'The custom message text. Use placeholders like {prize}, {winnerMentions}, etc.',
                                type: 3, // STRING
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'view',
                        description: 'View the current (custom or default) message for a key.',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'key',
                                description: 'The message key to view.',
                                type: 3, // STRING
                                required: true,
                                autocomplete: true
                            }
                        ]
                    },
                    {
                        name: 'reset',
                        description: 'Reset a custom message back to its default value.',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'key',
                                description: 'The message key to reset.',
                                type: 3, // STRING
                                required: true,
                                autocomplete: true
                            }
                        ]
                    },
                    {
                        name: 'listkeys',
                        description: 'List all available message keys that can be customized.',
                        type: 1, // SUB_COMMAND
                        // No options needed
                    }
                ]
            },
            {
                name: 'setcreatorrole',
                description: 'Manage roles that are allowed to create giveaways.',
                type: 2, // SUB_COMMAND_GROUP
                options: [
                    {
                        name: 'add',
                        description: 'Allow a role to create giveaways.',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'role',
                                description: 'The role to allow.',
                                type: 8, // ROLE
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'remove',
                        description: 'Disallow a role from creating giveaways.',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'role',
                                description: 'The role to disallow.',
                                type: 8, // ROLE
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'list',
                        description: 'List roles currently allowed to create giveaways.',
                        type: 1, // SUB_COMMAND
                        // No options needed
                    }
                ]
            }
        ]
    }
  ];

async function registerCommands(client, guildId) {
    try {
        if (guildId) {
            console.log(`Registering slash commands for guild ${guildId}...`);
            await client.application.commands.set(commands, guildId);
        } else {
            console.log('Registering global slash commands...');
            await client.application.commands.set(commands);
        }
        console.log('Slash commands registered');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
}

module.exports = { registerCommands, commands }; 