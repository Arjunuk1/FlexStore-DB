const fs = require("fs");
const path = require("path");
const JsonStorage = require("../storage/jsonStorage");
const Collection = require("./collection");
const SchemaValidator = require("../schema/schemaValidator");

class Database {
    constructor(dataDirectory, schemaDirectory) {
        this.dataDirectory = path.resolve(dataDirectory);
        this.collections = new Map();

        this.schemaDirectory = path.resolve(schemaDirectory);

        fs.mkdirSync(this.dataDirectory, { recursive: true });
        fs.mkdirSync(this.schemaDirectory, { recursive: true });
    }

    collection(name) {
        if (!this.collections.has(name)) {
            const filePath = path.join(
                this.dataDirectory,
                `${name}.json`
            );
            const schemaPath = path.join(
                this.schemaDirectory,
                `${name}.schema.json`
            );

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
                validator
            );

            this.collections.set(name, collection);
        }

        return this.collections.get(name);
    }
}

module.exports = Database;
