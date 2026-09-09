const crypto = require("node:crypto");

class Transaction {
    constructor(database, transactionManager) {
        this.id = `txn_${crypto.randomUUID()}`;
        this.database = database;
        this.transactionManager = transactionManager;
        this.operations = [];
        this.status = "ACTIVE";
        this.createdAt = Date.now();
        this.committedAt = null;
        this.rolledBackAt = null;
    }

    addOperation(operation) {
        if (this.status !== "ACTIVE") {
            throw new Error(`Transaction ${this.id} is ${this.status}`);
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

    getInfo() {
        return {
            id: this.id,
            status: this.status,
            operations: this.operations.length,
            createdAt: this.createdAt,
            committedAt: this.committedAt,
            rolledBackAt: this.rolledBackAt
        };
    }
}

module.exports = Transaction;