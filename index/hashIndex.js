const Index = require("./index");

class HashIndex extends Index {
    constructor(field, options = {}) {
        super(field, options);
        this.map = new Map();
    }

    insert(document) {
        const value = this.getValue(document, this.field);

        if (value === undefined) {
            return;
        }

        const existingIds = this.map.get(value);

        if (
            this.unique &&
            existingIds &&
            existingIds.size > 0 &&
            !existingIds.has(document.id)
        ) {
            throw new Error(
                `Duplicate value for unique index on "${this.field}"`
            );
        }

        const ids = existingIds || new Set();

        if (!existingIds) {
            this.map.set(value, ids);
        }

        ids.add(document.id);
    }

    remove(document) {
        const value = this.getValue(document, this.field);

        if (value === undefined) {
            return;
        }

        const ids = this.map.get(value);

        if (!ids) {
            return;
        }

        ids.delete(document.id);

        if (ids.size === 0) {
            this.map.delete(value);
        }
    }

    find(value) {
        const ids = this.map.get(value);

        return ids ? Array.from(ids) : [];
    }

    clear() {
        this.map.clear();
    }

    size() {
        let total = 0;

        for (const ids of this.map.values()) {
            total += ids.size;
        }

        return total;
    }

    getMetadata() {
        return {
            field: this.field,
            unique: this.unique,
            type: "hash",
            entries: this.size()
        };
    }

    getValue(document, field) {
        const parts = field.split(".");
        let value = document;

        for (const part of parts) {
            if (value === null || value === undefined) {
                return undefined;
            }

            value = value[part];
        }

        return value;
    }
}

module.exports = HashIndex;
