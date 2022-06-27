const analyzeTimings = require("../functions/analyzeTimings");
require("dotenv").config();

module.exports = async (client, message) => {
  if (message.author.bot) return;
  let array = [
    "991104654165426256",
    "991104688500002856",
    "991104710557839361",
  ];
  console.log(array);
  if (message.channel.id !== "991104654165426256")
    if (message.channel.id !== "991104688500002856")
      if (message.channel.id !== "991104710557839361") return;
  if (!message.content.startsWith("https://timings")) return message.delete();
  const timings = await analyzeTimings(
    message,
    client,
    message.content.split(" ")
  );
  if (timings) await message.reply(timings);
};
