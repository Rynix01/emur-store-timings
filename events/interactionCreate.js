const { MessageEmbed } = require("discord.js");
function clean(text) {
  if (typeof text === "string")
    return text
      .replace(/`/g, "`" + String.fromCharCode(8203))
      .replace(/@/g, "@" + String.fromCharCode(8203));
  else return text;
}
module.exports = async (client, interaction) => {
  if (!interaction.isButton()) return;
  const button = client.buttons.get(interaction.customId);
  if (!button)
    return interaction.reply({ content: "Bilinmeyen Buton!", ephemeral: true });

  interaction.deferUpdate();

  try {
    client.logger.info(
      `${interaction.user.tag} clicked button: ${button.name}, in ${interaction.guild.name}`
    );
    button.execute(interaction, client);
  } catch (error) {
    const interactionFailed = new MessageEmbed()
      .setColor(Math.floor(Math.random() * 16777215))
      .setTitle("ETKİLEŞİM BAŞARISIZ")
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.avatarURL({ dynamic: true }),
      })
      .addField("**Etkileşim:**", button.name)
      .addField("**Hata:**", clean(error))
      .addField("**Sunucu:**", interaction.guild.name)
      .addField("**Kanal:**", interaction.channel.name);
    interaction.user.send({ embeds: [interactionFailed] }).catch((e) => {
      client.logger.warn(e);
    });
    client.logger.error(error);
  }
};
