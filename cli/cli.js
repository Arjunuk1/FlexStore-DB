const net = require("node:net");
const readline = require("node:readline");
const { parseCommand } = require("./cliParser");

const host = process.env.FLEXSTORE_HOST || "127.0.0.1";
const port = Number(process.env.FLEXSTORE_PORT || 4000);
const client = net.createConnection({ host, port });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "flexstore> " });
let buffer = "";

client.setEncoding("utf8");
client.on("connect", () => {
    console.log("FlexStore DB CLI");
    console.log("Type HELP for available commands.");
    rl.prompt();
});
client.on("data", data => {
    buffer += data;
    const messages = buffer.split("\n");
    buffer = messages.pop();
    for (const message of messages) {
        if (!message.trim()) continue;
        try {
            const response = JSON.parse(message);
            if (response.success) {
                console.log(typeof response.result === "string" ? response.result : JSON.stringify(response.result, null, 2));
            } else {
                console.error(`Error: ${response.error}`);
            }
        } catch {
            console.error("Invalid server response");
        }
        rl.prompt();
    }
});
client.on("error", error => {
    console.error(`Unable to connect to FlexStore at ${host}:${port}: ${error.message}`);
    process.exitCode = 1;
});
client.on("close", () => {
    rl.close();
    console.log("Disconnected from FlexStore.");
});

rl.on("line", line => {
    try {
        const command = parseCommand(line);
        if (!command) return rl.prompt();
        if (command.command === "EXIT") return client.end();
        client.write(`${JSON.stringify(command)}\n`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        rl.prompt();
    }
});

rl.on("close", () => {
    if (!client.destroyed) client.end();
});