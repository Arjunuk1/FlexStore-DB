const net = require("node:net");
const path = require("node:path");
const DatabaseManager = require("../core/databaseManager");
const CommandHandler = require("./commandHandler");
const { encodeMessage, decodeMessage } = require("./protocol");

class DBServer {
    constructor(options = {}) {
        this.port = options.port ?? 4000;
        this.host = options.host || "127.0.0.1";
        this.databaseManager = options.databaseManager || new DatabaseManager(
            options.dataPath || path.join(__dirname, "..", "data", "databases"),
            options.schemaPath || path.join(__dirname, "..", "schemas", "databases")
        );
        this.handler = options.handler || new CommandHandler(this.databaseManager, {
            log: options.log || console.log
        });
        this.server = net.createServer(socket => this.handleConnection(socket));
    }

    start(callback) {
        this.server.listen(this.port, this.host, () => {
            const address = this.server.address();
            this.port = address.port;
            console.log(`[SERVER] FlexStore running on ${this.host}:${this.port}`);
            if (callback) callback(address);
        });
        return this.server;
    }

    stop() {
        return new Promise((resolve, reject) => {
            if (!this.server.listening) return resolve();
            this.server.close(error => error ? reject(error) : resolve());
        });
    }

    handleConnection(socket) {
        console.log("[SERVER] Client connected");
        socket.setEncoding("utf8");
        socket.session = {};
        let buffer = "";

        socket.on("data", data => {
            buffer += data;
            const messages = buffer.split("\n");
            buffer = messages.pop();
            for (const message of messages) this.handleMessage(socket, message);
        });
        socket.on("close", () => {
            if (socket.session.transaction) {
                try { socket.session.transaction.rollback(); } catch {}
            }
            console.log("[SERVER] Client disconnected");
        });
        socket.on("error", error => console.error("[SERVER] Socket error:", error.message));
    }

    async handleMessage(socket, message) {
        if (!message.trim()) return;
        try {
            const result = await this.handler.execute(decodeMessage(message), socket.session);
            socket.write(encodeMessage({ success: true, result }));
        } catch (error) {
            socket.write(encodeMessage({ success: false, error: error.message, details: error.details }));
        }
    }
}

if (require.main === module) new DBServer().start();

module.exports = DBServer;