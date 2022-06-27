module.exports = async (client) => {
  client.logger.info("Bot started!");
  setInterval(() => {
    client.user.setPresence({
      activities: [{ name: "Timings Raporlarınızı", type: "WATCHING" }],
    });
  }, 20000);

  const timer = (Date.now() - client.startTimestamp) / 1000;
  client.logger.info(`Done (${timer}s)! I am running!`);
};
