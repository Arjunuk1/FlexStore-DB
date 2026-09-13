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
        for (const name of fs.readdirSync(this.basePath, { withFileTypes: true })) {
            if (name.isDirectory() && /^[A-Za-z0-9_-]+$/.test(name.name)) {
                this.databases.set(name.name, this.openDatabase(name.name));
            }
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
        if (this.databases.has(name)) {
            throw new Error(`Database '${name}' already exists`);
        }

        const database = this.openDatabase(name);
        this.databases.set(name, database);
        return { name, created: true };
    }

    getDatabase(name) {
        if (!this.databases.has(name)) {
            throw new Error(`Database '${name}' does not exist`);
        }

        return this.databases.get(name);
    }

    listDatabases() {
        return Array.from(this.databases.keys()).sort();
    }

    dropDatabase(name) {
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