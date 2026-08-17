const path = require("path");
const JsonStorage = require("../storage/jsonStorage");
const Collection = require("./collection");

class Database {
    constructor(dataDirectory) {
        this.dataDirectory = path.resolve(dataDirectory);
        this.collections = new Map();
    }

    collection(name) {
        if (!this.collections.has(name)) {
            const filePath = path.join(
                this.dataDirectory,
                `${name}.json`
            );

            const storage = new JsonStorage(filePath);

            const collection = new Collection(
                name,
                storage
            );

            this.collections.set(name, collection);
        }

        return this.collections.get(name);
    }
}

module.exports = Database;
