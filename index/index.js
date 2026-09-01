class Index {
    constructor(field, options = {}) {
        this.field = field;
        this.unique = options.unique || false;
    }

    insert(document) {
        throw new Error("insert() not implemented");
    }

    remove(document) {
        throw new Error("remove() not implemented");
    }

    find(value) {
        throw new Error("find() not implemented");
    }

    clear() {
        throw new Error("clear() not implemented");
    }

    getMetadata() {
        return {
            field: this.field,
            unique: this.unique,
            type: "base"
        };
    }
}

module.exports = Index;
