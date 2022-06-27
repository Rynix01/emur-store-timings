const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const fetch = (...args) =>
  import("node-fetch").then(({ default: e }) => e(...args));
const YAML = require("yaml");
const fs = require("fs");
const createField = require("./createField.js");
const evalField = require("./evalField.js");
module.exports = async function analyzeTimings(message, client, args) {
  const Embed = new MessageEmbed()
    .setDescription(
      "Bunlar sihirli değerler değil. Bu ayarların birçoğunun sunucunuzun mekaniği üzerinde gerçek sonuçları vardır. Her ayarın işlevselliği hakkında ayrıntılı bilgi için [bu kılavuza](https://eternity.community/index.php/paper-optimization/) bakın."
    )
    .setFooter({
      text: `${message.member.user.tag} Tarafından istendi`,
      iconURL: message.member.user.avatarURL({ dynamic: true }),
    });

  let url = null;

  args.forEach((arg) => {
    if (arg.startsWith("https://timin") && arg.includes("?id="))
      url = arg.replace("/d=", "/?id=").split("#")[0].split("\n")[0];
    if (
      arg.startsWith("https://www.spigotmc.org/go/timings?url=") ||
      arg.startsWith("https://spigotmc.org/go/timings?url=")
    ) {
      Embed.addField(
        "❌ Spigot",
        "Spigot'ta timigs uygulaması sınırlı bilgiye sahiptir. Daha iyi timings analizi için [Purpur](https://purpurmc.org)'a geçin. Tüm eklentileriniz uyumlu olacak ve beğenmediyseniz kolayca geri dönebilirsiniz."
      ).setURL(url);
      return { embeds: [Embed] };
    }
  });

  if (!url) return false;

  client.logger.info(
    `{message.member.user.tag} (${message.member.user.id}) Tarafından yapıldı\nURLSİ : ${url}`
  );

  const timings_host = url.split("?id=")[0];
  const timings_id = url.split("?id=")[1];

  const timings_json = timings_host + "data.php?id=" + timings_id;
  const url_raw = url + "&raw=1";

  const response_raw = await fetch(url_raw);
  const request_raw = await response_raw.json();
  const response_json = await fetch(timings_json);
  const request = await response_json.json();

  const server_icon = timings_host + "image.php?id=" + request_raw.icon;
  Embed.setAuthor({
    name: "Timings Analizleri",
    iconURL: server_icon,
    url: url,
  });

  if (!request_raw || !request) {
    Embed.addFields(
      "❌ Geçersiz rapor",
      "Yeni bir timings raporu oluşturun.",
      true
    );
    return { embeds: [Embed] };
  }

  let version = request.timingsMaster.version;
  client.logger.info(version);

  if (version.endsWith("(MC: 1.17)"))
    version = version.replace("(MC: 1.17)", "(MC: 1.17.0)");

  const TIMINGS_CHECK = await YAML.parse(
    fs.readFileSync("./timings_check.yml", "utf8")
  );

  if (TIMINGS_CHECK.version && version) {
    // ghetto version check
    if (version.split("(MC: ")[1].split(")")[0] != TIMINGS_CHECK.version) {
      version = version.replace("git-", "").replace("MC: ", "");
      Embed.addField(
        "❌ Eski Sürüm",
        `\`${version}\` kullanıyorsunuz. \`${TIMINGS_CHECK.version}\` olarak güncelleyin.`,
        true
      );
    }
  }

  if (TIMINGS_CHECK.servers) {
    TIMINGS_CHECK.servers.forEach((server) => {
      if (version.includes(server.name)) Embed.addFields(createField(server));
    });
  }

  const timing_cost = parseInt(request.timingsMaster.system.timingcost);
  if (timing_cost > 300)
    Embed.addField(
      "❌ Timingcost",
      `İşlemcinize aşırı yüklenilmiş ve/veya yavaş. Daha iyi bir hosting bulun.`,
      true
    );

  const flags = request.timingsMaster.system.flags;
  const jvm_version = request.timingsMaster.system.jvmversion;
  if (flags.includes("-XX:+UseZGC") && flags.includes("-Xmx")) {
    const flaglist = flags.split(" ");
    flaglist.forEach((flag) => {
      if (flag.startsWith("-Xmx")) {
        let max_mem = flag.split("-Xmx")[1];
        max_mem = max_mem.replace("G", "000");
        max_mem = max_mem.replace("M", "");
        max_mem = max_mem.replace("g", "000");
        max_mem = max_mem.replace("m", "");
        if (parseInt(max_mem) < 10000)
          Embed.addField(
            "❌ Düşük Ram",
            "ZGC yalnızca çok fazla ram ile iyidir.",
            true
          );
      }
    });
  } else if (flags.includes("-Daikars.new.flags=true")) {
    if (!flags.includes("-XX:+PerfDisableSharedMem"))
      Embed.addField(
        "❌ Eski Flags",
        "Flags'lara `-XX:+PerfDisableSharedMem` ekleyin.",
        true
      );
    if (!flags.includes("-XX:G1MixedGCCountTarget=4"))
      Embed.addField(
        "❌ Eski Flags",
        "Flags'lara `XX:G1MixedGCCountTarget=4` ekleyin.",
        true
      );
    if (!flags.includes("-XX:+UseG1GC") && jvm_version.startswith("1.8."))
      Embed.addField(
        "❌ Aikar's Flags",
        "Aikar's flags kullanırken G1GC kullanmalısınız.",
        true
      );
    if (flags.includes("-Xmx")) {
      let max_mem = 0;
      const flaglist = flags.split(" ");
      flaglist.forEach((flag) => {
        if (flag.startsWith("-Xmx")) {
          max_mem = flag.split("-Xmx")[1];
          max_mem = max_mem.replace("G", "000");
          max_mem = max_mem.replace("M", "");
          max_mem = max_mem.replace("g", "000");
          max_mem = max_mem.replace("m", "");
        }
      });
      if (parseInt(max_mem) < 5400)
        Embed.addField(
          "❌ Düşük Ram",
          "Gücünüz yetiyorsa sunucunuza en az 6-10 GB RAM ayırın.",
          true
        );
      let index = 0;
      let max_online_players = 0;
      while (index < request.timingsMaster.data.length) {
        const timed_ticks =
          request.timingsMaster.data[index].minuteReports[0].ticks.timedTicks;
        const player_ticks =
          request.timingsMaster.data[index].minuteReports[0].ticks.playerTicks;
        const players = player_ticks / timed_ticks;
        max_online_players = Math.max(players, max_online_players);
        index = index + 1;
      }
      if (
        (1000 * max_online_players) / parseInt(max_mem) > 6 &&
        parseInt(max_mem) < 10000
      )
        Embed.addField(
          "❌ Düşük Ram",
          "Bu kadar oyuncuyla daha fazla RAM kullanıyor olmalısınız.",
          true
        );
      if (flags.includes("-Xms")) {
        let min_mem = 0;
        flaglist.forEach((flag) => {
          if (flag.startsWith("-Xmx")) {
            min_mem = flag.split("-Xmx")[1];
            min_mem = min_mem.replace("G", "000");
            min_mem = min_mem.replace("M", "");
            min_mem = min_mem.replace("g", "000");
            min_mem = min_mem.replace("m", "");
          }
        });
        if (min_mem != max_mem)
          Embed.addField(
            "❌ Aikar's Flags",
            "Aikar's flags kullanırken Xmx ve Xms değerleriniz eşit olmalıdır.",
            true
          );
      }
    }
  } else if (flags.includes("-Dusing.aikars.flags=mcflags.emc.gs")) {
    Embed.addField(
      "❌ Eski Flags",
      "[Aikar's flags](https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/) güncelleyin.",
      true
    );
  } else {
    Embed.addField(
      "❌ Aikar's Flags",
      " [Aikar's flags](https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/) kullanın.",
      true
    );
  }

  const cpu = parseInt(request.timingsMaster.system.cpu);
  if (cpu <= 2)
    Embed.addField(
      "❌ iş Parçacığı",
      `Yalnızca ${cpu} iş parçacığınız var. Daha iyi bir hosting bulun.`,
      true
    );

  const handlers = Object.keys(request_raw.idmap.handlers).map((i) => {
    return request_raw.idmap.handlers[i];
  });
  handlers.forEach((handler) => {
    let handler_name = handler[1];
    if (
      handler_name.startsWith("Komut İşlevi - ") &&
      handler_name.endsWith(":tick")
    ) {
      handler_name = handler_name.split("Komut İşlevi - ")[1].split(":tick")[0];
      Embed.addField(
        `❌ ${handler_name}`,
        "Bu veri paketi, gecikmeli olan komut işlevlerini kullanır.",
        true
      );
    }
  });

  const plugins = Object.keys(request.timingsMaster.plugins).map((i) => {
    return request.timingsMaster.plugins[i];
  });
  const server_properties = request.timingsMaster.config["server.properties"];
  const bukkit = request.timingsMaster.config
    ? request.timingsMaster.config.bukkit
    : null;
  const spigot = request.timingsMaster.config
    ? request.timingsMaster.config.spigot
    : null;
  const paper = request.timingsMaster.config
    ? request.timingsMaster.config.paper
    : null;
  const purpur = request.timingsMaster.config
    ? request.timingsMaster.config.purpur
    : null;

  if (TIMINGS_CHECK.plugins) {
    Object.keys(TIMINGS_CHECK.plugins).forEach((server_name) => {
      if (Object.keys(request.timingsMaster.config).includes(server_name)) {
        plugins.forEach((plugin) => {
          Object.keys(TIMINGS_CHECK.plugins[server_name]).forEach(
            (plugin_name) => {
              if (plugin.name == plugin_name) {
                const stored_plugin =
                  TIMINGS_CHECK.plugins[server_name][plugin_name];
                stored_plugin.name = plugin_name;
                Embed.addFields(createField(stored_plugin));
              }
            }
          );
        });
      }
    });
  }
  if (TIMINGS_CHECK.config) {
    Object.keys(TIMINGS_CHECK.config)
      .map((i) => {
        return TIMINGS_CHECK.config[i];
      })
      .forEach((config) => {
        Object.keys(config).forEach((option_name) => {
          const option = config[option_name];
          evalField(
            Embed,
            option,
            option_name,
            plugins,
            server_properties,
            bukkit,
            spigot,
            paper,
            purpur,
            client
          );
        });
      });
  }

  plugins.forEach((plugin) => {
    if (plugin.authors && plugin.authors.toLowerCase().includes("songoda")) {
      if (plugin.name == "EpicHeads")
        Embed.addField(
          "❌ EpicHeads",
          "Bu eklenti Songoda tarafından yapılmıştır, bu sıkıntılıdır. [HeadsPlus](https://spigotmc.org/resources/headsplus-»-1-8-1-16-4.40265/) veya [HeadDatabase](https://www.spigotmc.org/resources/head-database.14280/)) gibi bir alternatif bulmalısınız.",
          true
        );
      else if (plugin.name == "UltimateStacker")
        Embed.addField(
          "❌ UltimateStacker",
          "UltimateStacker aslında daha fazla gecikmeye neden olur.\nUltimateStacker'ı kaldırın.",
          true
        );
      else
        Embed.addField(
          `❌ ${plugin.name}`,
          "Bu eklenti Songoda tarafından yapılmıştır. Songoda eklentileri sıkıntılıdır. Bir alternatif bulmalısın.",
          true
        );
    }
  });

  const worlds = request_raw.worlds
    ? Object.keys(request_raw.worlds).map((i) => {
        return request_raw.worlds[i];
      })
    : [];
  let high_mec = false;
  worlds.forEach((world) => {
    const max_entity_cramming = parseInt(world.gamerules.maxEntityCramming);
    if (max_entity_cramming >= 24) high_mec = true;
  });
  if (high_mec)
    Embed.addField(
      "❌ maxEntityCramming",
      "Her dünyada /gamerule komutunu çalıştırarak bunu azaltın. Önerilen: 8.",
      true
    );

  const normal_ticks = request.timingsMaster.data[0].totalTicks;
  let worst_tps = 20;
  request.timingsMaster.data.forEach((data) => {
    const total_ticks = data.totalTicks;
    if (total_ticks == normal_ticks) {
      const end_time = data.end;
      const start_time = data.start;
      let tps = null;
      if (end_time == start_time) tps = 20;
      else tps = total_ticks / (end_time - start_time);
      if (tps < worst_tps) worst_tps = tps;
    }
  });
  let red = 0;
  let green = 0;
  if (worst_tps < 10) {
    red = 255;
    green = 255 * (0.1 * worst_tps);
  } else {
    red = 255 * (-0.1 * worst_tps + 2);
    green = 255;
  }
  Embed.setColor([Math.round(red), Math.round(green), 0]);

  const issue_count = Embed.fields.length;
  if (issue_count == 0) {
    Embed.addField("✅ Her şey yolunda", "Öneri olmadan analiz edildi.");
    return { embeds: [Embed] };
  }
  const components = [];
  if (issue_count >= 13) {
    let page = 1;
    if (message.customId) {
      const footer = message.message.embeds[0].footer.text.split(" • ");
      page = parseInt(
        footer[footer.length - 1].split("Sayfa ")[1].split(" ")[0]
      );
      if (message.customId == "timings_next") page = page + 1;
      if (message.customId == "timings_prev") page = page - 1;
      if (page == 0) page = Math.ceil(issue_count / 12);
      if (page > Math.ceil(issue_count / 12)) page = 1;
      const index = page * 12;
      Embed.fields.splice(index, issue_count);
      Embed.fields.splice(0, index - 12);
      footer[footer.length - 1] = `Sayfa ${page}/${Math.ceil(
        issue_count / 12
      )}`;
      Embed.setFooter({
        text: footer.join(" • "),
        iconURL: message.message.embeds[0].footer.iconURL,
      });
    } else {
      Embed.fields.splice(12, issue_count);
      Embed.addField(
        `Ek ${issue_count - 12} öneri daha`,
        "Butonlara tıklayarak daha fazlasını görebilirsiniz."
      );
      Embed.setFooter({
        text: `${
          message.member.user.tag
        } Tarafından talep edildi • Sayfa ${page}/${Math.ceil(
          issue_count / 12
        )}`,
        iconURL: message.member.user.avatarURL({ dynamic: true }),
      });
    }
    components.push(
      new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId("timings_prev")
          .setLabel("◄")
          .setStyle("SECONDARY"),
        new MessageButton()
          .setCustomId("timings_next")
          .setLabel("►")
          .setStyle("SECONDARY")
      )
    );
  }
  return { embeds: [Embed], components: components };
};
