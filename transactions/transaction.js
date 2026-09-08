class Transaction {
    constructor(id, database, transactionManager) {
        this.id = id;
        this.database = database;
        this.transactionManager = transactionManager;
        this.operations = [];
        this.status = "ACTIVE";
    }

    addOperation(operation) {
        if (this.status !== "ACTIVE") {
            throw new Error("Transaction is no longer active");
        }

        this.operations.push(operation);
        return this;
    }

    insert(collection, document) {
        return this.addOperation({ type: "INSERT", collection, document });
    }

    update(collection, filter, update) {
        return this.addOperation({ type: "UPDATE", collection, filter, update });
    }

    delete(collection, filter) {
        return this.addOperation({ type: "DELETE", collection, filter });
    }

    commit() {
        return this.transactionManager.commit(this);
    }

    rollback() {
        return this.transactionManager.rollback(this);
    }
}

module.exports = Transaction;