const fs = require('fs');
const path = require('path');
const config = require('./config');

const GIVEAWAYS_FILE_PATH = path.join(__dirname, '..', 'giveaways.json');
const LOG_CHANNELS_FILE_PATH = path.join(__dirname, '..', 'logchannels.json');
const CUSTOM_MESSAGES_FILE_PATH = path.join(__dirname, '..', 'custom_messages.json');
const GIVEAWAY_CREATOR_ROLES_FILE_PATH = path.join(__dirname, '..', 'giveaway_creator_roles.json');

let giveaways = [];
let giveawayLogChannels = {}; // guildId -> channelId
let customMessages = {}; // { guildId_or_GLOBAL: { key: text } }
let giveawayCreatorRoles = {}; // { guildId: [roleId1, roleId2] }

function loadGiveaways() {
  console.log('Loading giveaways from file...');
  if (fs.existsSync(GIVEAWAYS_FILE_PATH)) {
    try {
      giveaways = JSON.parse(fs.readFileSync(GIVEAWAYS_FILE_PATH));
      console.log(`Loaded ${giveaways.length} giveaways from file.`);
    } catch (err) {
      console.error('Error loading giveaways:', err);
      giveaways = [];
    }
  }
  return giveaways;
}

function saveGiveaways() {
  try {
    fs.writeFileSync(GIVEAWAYS_FILE_PATH, JSON.stringify(giveaways, null, 2));
  } catch (err) {
    console.error('Error saving giveaways:', err);
  }
}

function getGiveaways() {
    return giveaways;
}

function findGiveaway(messageId) {
    return giveaways.find(g => g.messageId === messageId);
}

function findGiveawayIndex(messageId) {
    return giveaways.findIndex(g => g.messageId === messageId);
}

function findScheduledGiveawayIndex(scheduleId) {
    return giveaways.findIndex(g => g.scheduleId === scheduleId && g.isScheduled);
}

function addGiveaway(giveawayData) {
    giveaways.push(giveawayData);
    saveGiveaways();
}

function updateGiveaway(index, giveawayData) {
    if (index !== -1 && giveaways[index]) {
        giveaways[index] = giveawayData;
        saveGiveaways();
    } else {
        console.error('Attempted to update non-existent giveaway at index:', index);
    }
}

function loadLogChannels() {
  console.log('Loading log channels from file...');
  if (fs.existsSync(LOG_CHANNELS_FILE_PATH)) {
    try {
      giveawayLogChannels = JSON.parse(fs.readFileSync(LOG_CHANNELS_FILE_PATH));
      console.log(`Loaded ${Object.keys(giveawayLogChannels).length} log channel configurations.`);
    } catch (err) {
      console.error('Error loading log channels:', err);
      giveawayLogChannels = {};
    }
  }
  return giveawayLogChannels;
}

function saveLogChannels() {
  try {
    fs.writeFileSync(LOG_CHANNELS_FILE_PATH, JSON.stringify(giveawayLogChannels, null, 2));
  } catch (err) {
    console.error('Error saving log channels:', err);
  }
}

function getLogChannels() {
    return giveawayLogChannels;
}

function getLogChannelForGuild(guildId) {
    return giveawayLogChannels[guildId];
}

function setLogChannelForGuild(guildId, channelId) {
    giveawayLogChannels[guildId] = channelId;
    saveLogChannels();
}

function deleteLogChannelForGuild(guildId) {
    delete giveawayLogChannels[guildId];
    saveLogChannels();
}

// --- Giveaway Creator Roles Management ---
function loadGiveawayCreatorRoles() {
    try {
        if (fs.existsSync(GIVEAWAY_CREATOR_ROLES_FILE_PATH)) {
            const data = fs.readFileSync(GIVEAWAY_CREATOR_ROLES_FILE_PATH, 'utf8');
            giveawayCreatorRoles = JSON.parse(data) || {};
            console.log('Loading giveaway creator roles from file...');
            console.log(`Loaded ${Object.keys(giveawayCreatorRoles).reduce((acc, guildId) => acc + giveawayCreatorRoles[guildId].length, 0)} creator role entries.`);
        } else {
            console.log('Giveaway creator roles file not found. Starting with empty configuration.');
            giveawayCreatorRoles = {};
            saveGiveawayCreatorRoles(); // Create the file if it doesn't exist
        }
    } catch (error) {
        console.error('Error loading giveaway creator roles:', error);
        giveawayCreatorRoles = {};
    }
}

function saveGiveawayCreatorRoles() {
    try {
        fs.writeFileSync(GIVEAWAY_CREATOR_ROLES_FILE_PATH, JSON.stringify(giveawayCreatorRoles, null, 2));
    } catch (error) {
        console.error('Error saving giveaway creator roles:', error);
    }
}

function getCreatorRoles(guildId) {
    return giveawayCreatorRoles[guildId] || [];
}

function addCreatorRole(guildId, roleId) {
    if (!giveawayCreatorRoles[guildId]) {
        giveawayCreatorRoles[guildId] = [];
    }
    if (!giveawayCreatorRoles[guildId].includes(roleId)) {
        giveawayCreatorRoles[guildId].push(roleId);
        saveGiveawayCreatorRoles();
        return true; // Added
    }
    return false; // Already exists
}

function removeCreatorRole(guildId, roleId) {
    if (giveawayCreatorRoles[guildId] && giveawayCreatorRoles[guildId].includes(roleId)) {
        giveawayCreatorRoles[guildId] = giveawayCreatorRoles[guildId].filter(id => id !== roleId);
        if (giveawayCreatorRoles[guildId].length === 0) {
            delete giveawayCreatorRoles[guildId]; // Clean up empty array for guild
        }
        saveGiveawayCreatorRoles();
        return true; // Removed
    }
    return false; // Not found
}

module.exports = {
  loadGiveaways,
  saveGiveaways,
  getGiveaways,
  findGiveaway,
  findGiveawayIndex,
  findScheduledGiveawayIndex,
  addGiveaway,
  updateGiveaway,
  loadLogChannels,
  saveLogChannels,
  getLogChannels,
  getLogChannelForGuild,
  setLogChannelForGuild,
  deleteLogChannelForGuild,
  loadGiveawayCreatorRoles,
  getCreatorRoles,
  addCreatorRole,
  removeCreatorRole
}; 