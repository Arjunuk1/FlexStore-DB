class Index {
    constructor(field) {
        this.field = field;
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
}

module.exports = Index;
