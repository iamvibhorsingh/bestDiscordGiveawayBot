// Utility function to select random winners without duplicates

function selectRandomWinners(users, count) {
  const winnerCount = Math.min(count, users.length);
  const winners = [];
  const entriesCopy = [...users];

  for (let i = 0; i < winnerCount; i++) {
    const randomIndex = Math.floor(Math.random() * entriesCopy.length);
    winners.push(entriesCopy[randomIndex]);
    entriesCopy.splice(randomIndex, 1);
  }

  return winners;
}

module.exports = { selectRandomWinners }; 