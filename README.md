# Discord Giveaway Bot

A feature-rich Discord bot for hosting and managing giveaways with advanced entry requirements, customizable messages, and role-based giveaway creation permissions.

## Features

*   **Create Giveaways:** Easily start giveaways with `/giveaway start`.
*   **Schedule Giveaways:** Schedule giveaways to start at a future time with `/giveaway schedule`.
*   **Edit Active Giveaways:** Modify details of running giveaways with `/giveaway edit` (e.g., prize, duration, winners, requirements).
*   **End Giveaways:** Manually end active giveaways using `/giveaway end`.
*   **Reroll Winners:** Reroll winners for ended giveaways with `/giveaway reroll`.
*   **Giveaway Log Channel:** Designate a channel for detailed giveaway logs using `/giveaway logchannel`.
*   **Enhanced Embeds:** Customize giveaways with image URLs and embed colors.
*   **Ephemeral Interactions:** Most bot replies are ephemeral, keeping your channels clean.
*   **Advanced Entry Requirements:**
    *   **Required Roles (All):** User must have *all* specified roles to enter.
    *   **Blacklisted Roles:** User must have *none* of the specified roles to enter.
    *   **Minimum Server Age:** User must be a member of the server for a minimum duration.
    *   **Minimum Account Age:** User's Discord account must meet a minimum age.
*   **Customizable Bot Messages:**
    *   Customize nearly all bot messages per server using `/giveawayutil customizemessage` commands.
*   **Role-Based Giveaway Creation:**
    *   Server administrators can designate specific roles that are allowed to create giveaways using `/giveawayutil setcreatorrole` commands.

## Setup Instructions

### Prerequisites

*   [Node.js](https://nodejs.org/) (v16.x or higher recommended)
*   [npm](https://www.npmjs.com/) (usually comes with Node.js)

### Steps

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd <repository_directory_name> 
    ```
    (Replace `<repository_url>` and `<repository_directory_name>` with your actual details)

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    *   Create a file named `.env` in the root directory of the project.
    *   Add your Discord Bot Token to this file:
        ```env
        DISCORD_TOKEN=your_bot_token_here
        ```
    *   You can obtain a bot token from the [Discord Developer Portal](https://discord.com/developers/applications).

## Running the Bot

To start the bot, run the following command from the project's root directory (ensure `index.js` is your main file):

```bash
npm start
```
Or directly:
```bash
node index.js
```

## Managing Giveaway Creation Permissions

By default, only users with `Administrator` or `Manage Server` permissions can create giveaways (`/giveaway start` and `/giveaway schedule`).

Server administrators can use the `/giveawayutil setcreatorrole` commands to designate specific roles that are also allowed to create giveaways:

*   If **no roles** are designated using `/giveawayutil setcreatorrole add`, only users with `Administrator` or `Manage Server` permissions can create giveaways.
*   If **one or more roles** are designated, users must either have `Administrator` or `Manage Server` permissions OR possess at least one of the designated creator roles to create giveaways.

This system allows for flexible control over who can initiate giveaways on your server.

## Available Commands

Permissions noted (e.g., *Requires "Manage Server"*) typically mean the user needs that permission or `Administrator`.

### `/giveaway start`
Starts a new giveaway immediately.
*   `duration`: (String) How long the giveaway should last (e.g., `1d`, `12h`, `30m`).
*   `winners`: (Integer) Number of winners.
*   `prize`: (String) The prize for the giveaway.
*   `required_role`: (Optional Role) A role users must have to enter.
*   `image_url`: (Optional String) URL of an image to display in the giveaway embed.
*   `embed_color`: (Optional String) Hex color code for the giveaway embed (e.g., `#FF0000`).
*   `required_roles_all`: (Optional String) Comma-separated list of role IDs. User must have ALL these roles.
*   `blacklisted_roles`: (Optional String) Comma-separated list of role IDs. User must have NONE of these roles.
*   `min_server_duration`: (Optional String) Minimum server membership duration (e.g., `7d`, `1mo`).
*   `min_account_duration`: (Optional String) Minimum Discord account age (e.g., `30d`, `3mo`).
    *   *Permission to create giveaways is based on server configuration (see "Managing Giveaway Creation Permissions" section) or having "Manage Server"/"Administrator" permission.*

### `/giveaway schedule`
Schedules a new giveaway to start at a future time.
*   (Options are the same as `/giveaway start`, plus `start_in` for when the giveaway should start).
    *   *Permission to create giveaways is based on server configuration (see "Managing Giveaway Creation Permissions" section) or having "Manage Server"/"Administrator" permission.*

### `/giveaway edit`
Edits an active giveaway.
*   `message_id`: (String) The message ID of the giveaway to edit.
*   Various optional parameters to change prize, winners, duration, requirements, embed appearance, etc.
    *   *Requires "Manage Server" permission.*

### `/giveaway end`
Manually ends an active giveaway.
*   `message_id`: (String) The message ID of the giveaway to end.
    *   *Requires "Manage Server" permission.*

### `/giveaway reroll`
Rerolls winners for an ended giveaway.
*   `message_id`: (String) The message ID of the giveaway to reroll.
*   `winners`: (Optional Integer) Number of new winners to pick (defaults to original winner count).
    *   *Requires "Manage Server" permission.*

### `/giveaway logchannel`
Sets or clears the channel for giveaway logging.
*   `channel`: (Optional Channel) The text channel to send logs to. If not provided, clears the log channel.
    *   *Requires "Manage Server" permission.*

### `/giveawayutil customizemessage`
Manages customizable bot messages for your server. All subcommands require "Manage Server" permission.
*   **`set`**: Sets a custom message for a key.
    *   `key`: (String) The message key.
    *   `text`: (String) The custom message text (use placeholders).
*   **`view`**: Shows the current message for a key.
    *   `key`: (String) The message key.
*   **`reset`**: Resets a message to its default.
    *   `key`: (String) The message key.
*   **`listkeys`**: Lists all customizable message keys.

### `/giveawayutil setcreatorrole`
Manages which roles can create giveaways. All subcommands require "Manage Server" or "Administrator" permission.
*   **`add`**: Allows a specific role to create giveaways.
    *   `role`: (Role) The role to add.
*   **`remove`**: Disallows a specific role from creating giveaways.
    *   `role`: (Role) The role to remove.
*   **`list`**: Lists all roles currently allowed to create giveaways.

## Customizing Bot Messages

This bot allows server administrators (users with "Manage Server" or "Administrator" permission) to customize most of the messages it sends using the `/giveawayutil customizemessage` commands (see above).

1.  **Identifying Message Keys:** Use `listkeys` and `view` subcommands.
2.  **Setting a Custom Message:** Use the `set` subcommand.
3.  **Resetting a Message:** Use the `reset` subcommand.

Custom messages are stored per-server in `custom_messages.json` (managed by the bot).

## Advanced Entry Requirements

When using `/giveaway start` or `/giveaway schedule`, you can specify advanced entry requirements:

*   **Required Roles (All) (`required_roles_all`):** Comma-separated Role IDs. User must have ALL.
*   **Blacklisted Roles (`blacklisted_roles`):** Comma-separated Role IDs. User must have NONE.
*   **Minimum Server Membership Duration (`min_server_duration`):** e.g., `7d`, `1mo`.
*   **Minimum Account Age (`min_account_duration`):** e.g., `30d`, `6mo`.

These requirements are checked when the giveaway ends and winners are being selected.

## Data Storage

*   `giveaways.json`: Stores active and past giveaway data.
*   `logchannels.json`: Stores log channel configurations per server.
*   `custom_messages.json`: Stores server-specific custom messages.
*   `giveaway_creator_roles.json`: Stores roles permitted to create giveaways per server.

These files are created and managed by the bot in its root directory. It is recommended to add them to your `.gitignore` if you do not want to commit user-specific data. 