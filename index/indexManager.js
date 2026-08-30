const HashIndex = require("./hashIndex");

class IndexManager {
    constructor() {
        this.indexes = new Map();
    }

    createIndex(field) {
        if (this.indexes.has(field)) {
            throw new Error(`Index already exists for field: ${field}`);
        }

        const index = new HashIndex(field);
        this.indexes.set(field, index);

        return index;
    }

    dropIndex(field) {
        if (!this.indexes.has(field)) {
            throw new Error(`Index does not exist for field: ${field}`);
        }

        this.indexes.delete(field);
    }

    getIndex(field) {
        return this.indexes.get(field);
    }

    hasIndex(field) {
        return this.indexes.has(field);
    }

    listIndexes() {
        return Array.from(this.indexes.keys());
    }

    insert(document) {
        for (const index of this.indexes.values()) {
            index.insert(document);
        }
    }

    remove(document) {
        for (const index of this.indexes.values()) {
            index.remove(document);
        }
    }

    clear() {
        this.indexes.clear();
    }
}

module.exports = IndexManager;
