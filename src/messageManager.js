const fs = require('fs');
const defaultMessages = require('./defaultMessages');
const config = require('./config');

let customMessages = {}; // guildId -> { messageKey -> customString }

function loadCustomMessages() {
    console.log('Loading custom messages from file...');
    if (fs.existsSync(config.CUSTOM_MESSAGES_FILE)) {
        try {
            customMessages = JSON.parse(fs.readFileSync(config.CUSTOM_MESSAGES_FILE));
            console.log(`Loaded custom messages for ${Object.keys(customMessages).length} guilds.`);
        } catch (err) {
            console.error('Error loading custom messages:', err);
            customMessages = {};
        }
    } else {
        console.log('Custom messages file not found. Using defaults.');
    }
}

function saveCustomMessages() {
    try {
        fs.writeFileSync(config.CUSTOM_MESSAGES_FILE, JSON.stringify(customMessages, null, 2));
    } catch (err) {
        console.error('Error saving custom messages:', err);
    }
}

function getMessage(guildId, key, placeholders = {}) {
    let messageString;
    if (guildId && customMessages[guildId] && customMessages[guildId][key]) {
        messageString = customMessages[guildId][key];
    } else {
        messageString = defaultMessages[key];
    }

    if (!messageString) {
        console.warn(`[MessageManager] Message key "${key}" not found in defaults or custom messages for guild ${guildId}.`);
        return `Missing message for key: ${key}`;
    }

    // Replace placeholders
    for (const placeholder in placeholders) {
        // Global regex to replace all occurrences
        const regex = new RegExp(`\\{${placeholder}\\}`, 'g'); 
        messageString = messageString.replace(regex, placeholders[placeholder]);
    }

    return messageString;
}

function setCustomMessage(guildId, key, value) {
    if (!defaultMessages[key]) {
        console.warn(`[MessageManager] Attempted to set custom message for non-existent key: ${key}`);
        return false; // Indicate failure
    }
    if (!customMessages[guildId]) {
        customMessages[guildId] = {};
    }
    customMessages[guildId][key] = value;
    saveCustomMessages();
    return true; // Indicate success
}

function resetCustomMessage(guildId, key) {
    if (customMessages[guildId] && customMessages[guildId][key]) {
        delete customMessages[guildId][key];
        if (Object.keys(customMessages[guildId]).length === 0) {
            delete customMessages[guildId]; // Clean up empty guild objects
        }
        saveCustomMessages();
        return true;
    }
    return false; // No custom message was set for this key
}

function getCustomMessage(guildId, key) {
    return customMessages[guildId] ? customMessages[guildId][key] : undefined;
}

function getAllMessageKeys() {
    return Object.keys(defaultMessages);
}

module.exports = {
    loadCustomMessages,
    getMessage,
    setCustomMessage,
    resetCustomMessage,
    getCustomMessage, // To view the raw custom message or undefined
    getAllMessageKeys,
    defaultMessages // Exporting for listing defaults if needed
}; 