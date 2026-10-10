const fs = require("fs");
const path = require("path");
const Database = require("./database");

class DatabaseManager {
    constructor(basePath, schemaBasePath = path.join(basePath, "schemas")) {
        this.basePath = path.resolve(basePath);
        this.schemaBasePath = path.resolve(schemaBasePath);
        this.databases = new Map();

        fs.mkdirSync(this.basePath, { recursive: true });
        fs.mkdirSync(this.schemaBasePath, { recursive: true });
        this.loadDatabases();
    }

    loadDatabases() {
        const names = new Set();
        for (const name of fs.readdirSync(this.basePath, { withFileTypes: true })) {
            if (name.isDirectory() && /^[A-Za-z0-9_-]+$/.test(name.name)) {
                names.add(name.name);
                if (!this.databases.has(name.name)) this.databases.set(name.name, this.openDatabase(name.name));
                else this.databases.get(name.name).refreshFromDisk();
            }
        }
        for (const name of this.databases.keys()) {
            if (!names.has(name)) this.databases.delete(name);
        }
    }

    openDatabase(name) {
        return new Database(
            path.join(this.basePath, name),
            path.join(this.schemaBasePath, name)
        );
    }

    validateName(name) {
        if (typeof name !== "string" || !/^[A-Za-z0-9_-]+$/.test(name)) {
            throw new Error("Database names may contain letters, numbers, _ and - only");
        }
    }

    createDatabase(name) {
        this.validateName(name);
        this.loadDatabases();
        if (this.databases.has(name)) {
            throw new Error(`Database '${name}' already exists`);
        }

        const database = this.openDatabase(name);
        this.databases.set(name, database);
        return { name, created: true };
    }

    getDatabase(name) {
        this.loadDatabases();
        if (!this.databases.has(name)) {
            throw new Error(`Database '${name}' does not exist`);
        }

        return this.databases.get(name);
    }

    listDatabases() {
        this.loadDatabases();
        return Array.from(this.databases.keys()).sort();
    }

    dropDatabase(name) {
        this.loadDatabases();
        const database = this.getDatabase(name);
        if (database.transactionManager.listActiveTransactions().length > 0) {
            throw new Error(`Database '${name}' has active transactions`);
        }

        this.databases.delete(name);
        fs.rmSync(path.join(this.basePath, name), { recursive: true, force: true });
        fs.rmSync(path.join(this.schemaBasePath, name), { recursive: true, force: true });
        return { name, deleted: true };
    }
}

module.exports = DatabaseManager;