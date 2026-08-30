const Index = require("./index");

class HashIndex extends Index {
    constructor(field) {
        super(field);
        this.map = new Map();
    }

    insert(document) {
        const value = this.getValue(document, this.field);

        if (value === undefined) {
            return;
        }

        if (!this.map.has(value)) {
            this.map.set(value, new Set());
        }

        this.map.get(value).add(document.id);
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
