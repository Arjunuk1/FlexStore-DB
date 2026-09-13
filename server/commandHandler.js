const INFO = {
    name: "FlexStore DB",
    version: "1.0",
    storageEngine: "JSON",
    queryEngine: "Custom",
    index: "Hash Index",
    transactions: true,
    wal: true,
    crashRecovery: true,
    protocol: "TCP/JSON"
};

class CommandHandler {
    constructor(databaseManager, options = {}) {
        this.databaseManager = databaseManager;
        this.log = options.log || (() => {});
    }

    async execute(command, session = {}) {
        const name = String(command.command || "").toUpperCase();
        this.log(`[QUERY] ${name}${command.collection ? ` ${command.collection}` : ""}`);

        switch (name) {
            case "PING": return { message: "PONG" };
            case "HELP": return this.help();
            case "INFO": return INFO;
            case "STATUS": return this.status(session);
            case "SHOW_DATABASES": return this.databaseManager.listDatabases();
            case "CREATE_DATABASE": return this.databaseManager.createDatabase(command.name);
            case "DROP_DATABASE": return this.dropDatabase(command, session);
            case "USE": return this.useDatabase(command, session);
            case "SHOW_COLLECTIONS": return this.requireDatabase(session).listCollections();
            case "CREATE_COLLECTION": return this.requireDatabase(session).createCollection(command.collection);
            case "DROP_COLLECTION": return this.requireDatabase(session).dropCollection(command.collection);
            case "CREATE_INDEX": return this.collection(command, session).createIndex(command.field, command.options || {});
            case "DROP_INDEX": return this.collection(command, session).dropIndex(command.field);
            case "INSERT": return this.insert(command, session);
            case "FIND": return this.find(command, session);
            case "UPDATE": return this.update(command, session);
            case "DELETE": return this.remove(command, session);
            case "COUNT": return (await this.find(command, session)).length;
            case "EXPLAIN": return this.collection(command, session).find(command.query || {}).explain();
            case "BEGIN": return this.begin(session);
            case "COMMIT": return this.commit(session);
            case "ROLLBACK": return this.rollback(session);
            case "SHOW_WAL": return this.requireDatabase(session).transactionManager.wal.readAll();
            default: throw new Error(`Unknown command: ${command.command || ""}`);
        }
    }

    useDatabase(command, session) {
        if (!command.name) throw new Error("Usage: USE <database>");
        session.database = this.databaseManager.getDatabase(command.name);
        session.databaseName = command.name;
        return { name: command.name, selected: true };
    }

    dropDatabase(command, session) {
        if (session.databaseName === command.name) {
            session.database = null;
            session.databaseName = null;
            session.transaction = null;
        }
        return this.databaseManager.dropDatabase(command.name);
    }

    requireDatabase(session) {
        if (!session.database) throw new Error("No database selected. Use a database first.");
        return session.database;
    }

    collection(command, session) {
        if (!command.collection) throw new Error("A collection is required");
        return this.requireDatabase(session).collection(command.collection);
    }

    insert(command, session) {
        const document = { ...(command.document || {}) };
        if (document.id === undefined) document.id = Date.now();
        if (session.transaction) {
            session.transaction.insert(command.collection, document);
            return { staged: true, document };
        }
        return this.collection(command, session).insert(document);
    }

    find(command, session) {
        return this.collection(command, session).find(command.query || {}).exec();
    }

    update(command, session) {
        const filter = command.id === undefined ? (command.filter || {}) : { id: command.id };
        if (session.transaction) {
            session.transaction.update(command.collection, filter, command.update || {});
            return { staged: true, filter, update: command.update || {} };
        }
        return this.collection(command, session).update(filter, command.update || {});
    }

    remove(command, session) {
        const filter = command.id === undefined ? (command.filter || {}) : { id: command.id };
        if (session.transaction) {
            session.transaction.delete(command.collection, filter);
            return { staged: true, filter };
        }
        return this.collection(command, session).delete(filter);
    }

    begin(session) {
        if (session.transaction) throw new Error("A transaction is already active");
        session.transaction = this.requireDatabase(session).beginTransaction();
        this.log(`[TXN] Transaction started: ${session.transaction.id}`);
        return session.transaction.getInfo();
    }

    commit(session) {
        if (!session.transaction) throw new Error("No active transaction");
        const result = session.transaction.commit();
        session.transaction = null;
        this.log(`[TXN] Transaction committed: ${result.transactionId}`);
        return result;
    }

    rollback(session) {
        if (!session.transaction) throw new Error("No active transaction");
        const result = session.transaction.rollback();
        session.transaction = null;
        this.log(`[TXN] Transaction rolled back: ${result.transactionId}`);
        return result;
    }

    status(session) {
        const database = session.database;
        return {
            server: "RUNNING",
            database: session.databaseName || null,
            collections: database ? database.listCollections().length : 0,
            activeTransactions: database ? database.transactionManager.listActiveTransactions().length : 0,
            wal: Boolean(database),
            indexes: database ? database.listCollections().reduce((total, name) => total + database.collection(name).listIndexes().length, 0) : 0
        };
    }

    help() {
        return [
            "FlexStore DB Commands",
            "CREATE DATABASE <name> | DROP DATABASE <name> | USE <name>",
            "SHOW DATABASES | SHOW COLLECTIONS",
            "CREATE COLLECTION <name> | DROP COLLECTION <name>",
            "CREATE INDEX <collection> <field> | DROP INDEX <collection> <field>",
            "INSERT <collection> <json> | FIND <collection> <json>",
            "UPDATE <collection> <id> <json> | DELETE <collection> <id>",
            "COUNT <collection> <json> | EXPLAIN <collection> <json>",
            "BEGIN | COMMIT | ROLLBACK | SHOW WAL",
            "STATUS | INFO | PING | HELP | EXIT"
        ].join("\n");
    }
}

module.exports = CommandHandler;