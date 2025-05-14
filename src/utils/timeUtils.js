// Utility function to parse duration strings into milliseconds

function parseDuration(duration) {
  const regex = /(\d+)([dhms])/g;
  let ms = 0;
  let match;

  while ((match = regex.exec(duration)) !== null) {
    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd': ms += value * 24 * 60 * 60 * 1000; break;
      case 'h': ms += value * 60 * 60 * 1000; break;
      case 'm': ms += value * 60 * 1000; break;
      case 's': ms += value * 1000; break;
    }
  }

  return ms || null; // Return null if no valid duration found
}

function msToHuman(ms, showSeconds = true) {
    if (ms === null || ms === undefined || ms === 0) return 'N/A';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    let humanReadable = [];
    if (days > 0) humanReadable.push(`${days}d`);
    if (hours > 0) humanReadable.push(`${hours}h`);
    if (minutes > 0) humanReadable.push(`${minutes}m`);
    if (showSeconds && seconds > 0) humanReadable.push(`${seconds}s`);

    return humanReadable.length > 0 ? humanReadable.join(' ') : (showSeconds ? '0s' : 'N/A');
}

module.exports = { parseDuration, msToHuman }; 