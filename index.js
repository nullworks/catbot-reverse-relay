/*
	relay input discord bot
	by: dogecore
*/

const discordjs = require("discord.js"),
	request = require("request"),
	fs = require("fs");

if (!fs.existsSync("private.json")) {
	console.log("Please create private.json by using private.example.json");
	process.exit(0);
}

var config = {};

try {
	config = JSON.parse(fs.readFileSync("private.json"));
} catch (ex) {
	console.log("Exception raised while trying to read config.")
	console.error(ex)
	process.exit(0);
} finally {
	if (typeof (config.token) != "string" || config.testing_mode == undefined) {
		console.log("Config does not have required fields. Are you sure you used private.example.json?");
		process.exit(0);
	}

	if (!config.testing_whitelist) {
		config.testing_whitelist = {}
	}
}

if (!fs.existsSync("/tmp/cat-webpanel-password")) {
	console.log("Please start webpanel first");
	process.exit(0);
}

var client = new discordjs.Client(),
	cooldown_table = {};

function process_cooldown(id) {
	if (cooldown_table[id]) return false;

	cooldown_table[id] = true;
	setTimeout(() => { cooldown_table[id] = undefined; }, 2000);

	return true;
}

function safe_string(str) {
	return str.replace(/\"/g, "").replace(/&&/g, "").replace(/;/g, "");
}

console.log("Logging in...");

client.on("ready", function () {
	console.log("Logged in! Tag: " + client.user.tag);
	client.user.setActivity("for $$help", { type: 'WATCHING' });
});

client.on("message", function (msg) {
	if (!msg.member) return;
	if (msg.author.bot || !config.testing_whitelist[msg.author.id] && config.testing_mode) return;
	if (!msg.content.startsWith("$$help")) return;

	if (!process_cooldown(msg.author.id)) return;

	console.log("Should have deleted")
	msg.reply("Available Commands:").then(msg => console.log("Should have deleted"));
	msg.channel.send("```$$send:\ncommand usage: $$send ID TEXT\nexample: $$send 1 hi!```").then(msg => console.log("Should have deleted"));
	msg.channel.send("```$$cmd:\ncommand usage: $$cmd ID TEXT\nexample: $$send 1 cat_ipc_id```").then(msg => console.log("Should have deleted"));
	msg.channel.send("You are also able to mass-send - use * as ID").then(msg => console.log("Should have deleted"));
})

client.on("message", function (msg) {
	if (!msg.member) return;
	if (msg.author.bot || !config.testing_whitelist[msg.author.id] && config.testing_mode) return;
	if (!msg.content.startsWith("$$send")) return;

	if (!process_cooldown(msg.author.id)) return;

	var split = msg.cleanContent.split(" ");

	if (split.length < 3) {
		msg.reply("command usage: $$send ID TEXT\nexample: $$send 1 hi!");
		if (msg.member.roles.cache.find(role => role.name === "IPC")) {
			msg.channel.send("You are also able to mass-send - use * as ID");
		}
		return;
	}

	if (split[1] == "*") {
		if (msg.member.roles.cache.find(role => role.name === "IPC")) {
			request.post(
				{
					url: 'http://127.0.0.1:8081/api/direct/exec_all',
					body: JSON.stringify({
						cmd: "say \"[RELAY] " + safe_string(msg.cleanContent.substring(8 + split[1].length)) + "\""
					}),
					headers: {
						"Content-Type": "application/json"
					}
				},
				function (error, http_response, body) {
					if (error) {
						msg.channel.send("Error: request error (" + error.toString() + ")");
						return;
					}

					var bd = undefined;

					try {
						bd = JSON.parse(body);
					} catch (ex) {
						msg.channel.send("Error: JSON parse error (" + ex.message + ")");
						return;
					}

					if (bd == {} || bd == undefined) return;

					if (bd.status == "error") {
						msg.channel.send("Error: IPC processing error (" + bd.error + ")");
					} else {
						msg.guild.channels.cache.find(channel => channel.name === "tf2-chat-relay").send("``[RELAY ALL]`` **" + msg.author.tag + ":** " + msg.cleanContent.substring(8 + split[1].length));        
						msg.channel.send("Message sent!").then((msg) => { console.log("Should have deleted") });
					}
				});
		} else {
			msg.reply("you require the \"IPC\" Role to use * as an ID.").then((msg) => { console.log("Should have deleted") });
			if (!msg.guild.roles.cache.find(role => role.name === "IPC"))
				msg.guild.roles.create({ data: { name: "IPC" } });
		}

		return;
	}

	request.post(
		{
			url: 'http://127.0.0.1:8081/api/direct/exec',
			body: JSON.stringify({
				target: parseInt(split[1]),
				cmd: "say \"[RELAY] " + safe_string(msg.cleanContent.substring(8 + split[1].length)) + "\""
			}),
			headers: {
				"Content-Type": "application/json"
			}
		},
		function (error, http_response, body) {
			if (error) {
				msg.channel.send("Error: request error (" + error.toString() + ")");
				return;
			}

			var bd = undefined;

			try {
				bd = JSON.parse(body);
			} catch (ex) {
				msg.channel.send("Error: JSON parse error (" + ex.message + ")");
				return;
			}

			if (bd == {} || bd == undefined) return;

			if (bd.status == "error") {
				msg.channel.send("Error: IPC processing error (" + bd.error + ")");
			} else {
				msg.guild.channels.cache.find(channel => channel.name === "tf2-chat-relay").send("``[RELAY ID " + split[1] + "]`` **" + msg.author.tag + ":** " + msg.cleanContent.substring(8 + split[1].length));
				msg.channel.send("Message sent!").then((msg) => { console.log("Should have deleted"); });
			}
		});

});

client.on("message", function (msg) {
	if (!msg.member) return;
	if (msg.author.bot || !config.testing_whitelist[msg.author.id] && config.testing_mode) return;
	if (!msg.content.startsWith("$$cmd")) return;

	if (!process_cooldown(msg.author.id)) return;

	if (!msg.member.roles.cache.find(role => role.name === "IPC MASTER")) {
		msg.reply('you require the \"IPC MASTER\" Role for that.');
		if (!msg.guild.roles.cache.find(role => role.name === "IPC MASTER"))
			msg.guild.roles.create({ data: { name: "IPC MASTER" } });
		return;
	}

	var split = msg.cleanContent.split(" ");

	if (split.length < 3) {
		msg.reply("command usage: $$cmd ID TEXT\nexample: $$send 1 cat_ipc_id\n* - all");
		return;
	}

	if (split[1] == "*") {
		request.post(
			{
				url: 'http://127.0.0.1:8081/api/direct/exec_all',
				body: JSON.stringify({
					cmd: msg.cleanContent.substring(7 + split[1].length)
				}),
				headers: {
					"Content-Type": "application/json"
				}
			},
			function (error, http_response, body) {
				console.log(`${error}, ${http_response}, ${body}`);
				if (error) {
					msg.channel.send("Error: request error (" + error.toString() + ")");
					return;
				}

				var bd = "";

				try {
					bd = JSON.parse(body);
				} catch (ex) {
					msg.channel.send("Error: JSON parse error (" + ex.message + ")");
					return;
				}

				if (bd == "" || bd == {} || bd == undefined) return;

				if (bd.status == "error") {
					msg.channel.send("Error: IPC processing error (" + bd.error + ")");
				} else {
					msg.channel.send("Command sent!").then((msg) => { console.log("Should have deleted"); });
				}
			});

		return;
	}

	request.post(
		{
			url: 'http://127.0.0.1:8081/api/direct/exec',
			body: JSON.stringify({
				target: parseInt(split[1]),
				cmd: msg.cleanContent.substring(7 + split[1].length)
			}),
			headers: {
				"Content-Type": "application/json"
			}
		},
		function (error, http_response, body) {
			if (error) {
				msg.channel.send("Error: request error (" + error.toString() + ")");
				return;
			}

			var bd = "";

			try {
				bd = JSON.parse(body);
			} catch (ex) {
				msg.channel.send("Error: JSON parse error (" + ex.message + ")");
				return;
			}

			if (bd == "" || bd == {} || bd == undefined) return;

			if (bd.status == "error") {
				msg.channel.send("Error: IPC processing error (" + bd.error + ")");
			} else {
				msg.channel.send("Command sent!").then((msg) => { console.log("Should have deleted"); });
			}
		});
});

client.on("message", function (msg) {
	if (!msg.member) return;
	if (msg.author.bot) return;
	if (!(msg.channel.name == "tf2-chat-relay")) return;

	console.log("Should have deleted");
});

client.login(config.token);
