const fs = require("fs");
const path = require("path");
const JsonStorage = require("../storage/jsonStorage");
const Collection = require("./collection");
const SchemaValidator = require("../schema/schemaValidator");
const TransactionManager = require("../transactions/transactionManager");

class Database {
    constructor(dataDirectory, schemaDirectory) {
        this.dataDirectory = path.resolve(dataDirectory);
        this.collections = new Map();

        this.schemaDirectory = path.resolve(schemaDirectory);

        fs.mkdirSync(this.dataDirectory, { recursive: true });
        fs.mkdirSync(this.schemaDirectory, { recursive: true });

        this.transactionManager = new TransactionManager(
            this,
            this.dataDirectory
        );
        this.transactionManager.recover();
    }

    collection(name) {
        if (!this.collections.has(name)) {
            this.assertCollectionName(name);
            const filePath = path.join(this.dataDirectory, `${name}.json`);
            const schemaPath = path.join(
                this.schemaDirectory,
                `${name}.schema.json`
            );
            const indexPath = path.join(this.dataDirectory, `${name}.indexes.json`);

            const storage = new JsonStorage(filePath);
            let validator = null;

            if (fs.existsSync(schemaPath)) {
                const schema = JSON.parse(
                    fs.readFileSync(schemaPath, "utf8")
                );

                validator = new SchemaValidator(schema);
            }

            const collection = new Collection(
                name,
                storage,
                validator,
                indexPath
            );
            collection.schemaMtime = fs.existsSync(schemaPath) ? fs.statSync(schemaPath).mtimeMs : 0;

            this.collections.set(name, collection);
        }

        return this.collections.get(name);
    }

    listCollections() {
        const names = new Set(this.collections.keys());

        for (const file of fs.readdirSync(this.dataDirectory)) {
            if (file.endsWith(".collection.json")) {
                names.add(file.slice(0, -16));
            } else if (file.endsWith(".json") && file !== "wal.log" && !file.endsWith(".indexes.json")) {
                names.add(file.slice(0, -5));
            }
        }

        return Array.from(names).sort();
    }

    createCollection(name) {
        this.assertCollectionName(name);
        const markerPath = path.join(this.dataDirectory, `${name}.collection.json`);
        if (this.listCollections().includes(name)) {
            throw new Error(`Collection '${name}' already exists`);
        }
        this.collection(name);
        fs.writeFileSync(markerPath, JSON.stringify({ name }, null, 2));
        return { name, created: true };
    }

    getSchema(name) {
        this.assertCollectionName(name);
        const schemaPath = path.join(this.schemaDirectory, `${name}.schema.json`);
        if (!fs.existsSync(schemaPath)) return null;
        return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    }

    updateSchema(name, schema) {
        this.assertCollectionName(name);
        if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
            throw new Error("Schema must be a JSON object");
        }
        const schemaPath = path.join(this.schemaDirectory, `${name}.schema.json`);
        fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
        this.collections.delete(name);
        this.collection(name);
        return schema;
    }

    deleteSchema(name) {
        this.assertCollectionName(name);
        const schemaPath = path.join(this.schemaDirectory, `${name}.schema.json`);
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema for collection '${name}' does not exist`);
        }
        fs.rmSync(schemaPath);
        this.collections.delete(name);
        return { name, deleted: true };
    }

    dropCollection(name) {
        this.assertCollectionName(name);
        const filePath = path.join(this.dataDirectory, `${name}.json`);
        const markerPath = path.join(this.dataDirectory, `${name}.collection.json`);
        const schemaPath = path.join(this.schemaDirectory, `${name}.schema.json`);
        const indexPath = path.join(this.dataDirectory, `${name}.indexes.json`);

        if (!fs.existsSync(filePath) && !fs.existsSync(markerPath) && !this.collections.has(name)) {
            throw new Error(`Collection '${name}' does not exist`);
        }

        fs.rmSync(filePath, { force: true });
        fs.rmSync(markerPath, { force: true });
        fs.rmSync(indexPath, { force: true });
        fs.rmSync(schemaPath, { force: true });
        this.collections.delete(name);
        return { name, deleted: true };
    }

    refreshFromDisk() {
        for (const name of this.listCollections()) {
            if (!this.collections.has(name)) continue;
            const schemaPath = path.join(this.schemaDirectory, `${name}.schema.json`);
            const schemaMtime = fs.existsSync(schemaPath) ? fs.statSync(schemaPath).mtimeMs : 0;
            const collection = this.collections.get(name);
            if (collection.schemaMtime !== schemaMtime) {
                this.collections.delete(name);
                const refreshed = this.collection(name);
                refreshed.schemaMtime = schemaMtime;
            } else {
                collection.refreshFromDisk();
            }
        }
    }

    assertCollectionName(name) {
        if (typeof name !== "string" || !/^[A-Za-z0-9_-]+$/.test(name)) {
            throw new Error("Collection names may contain letters, numbers, _ and - only");
        }
    }

    beginTransaction() {
        return this.transactionManager.begin();
    }
}

module.exports = Database;
