class TransactionContext {
    constructor(id) {
        this.id = id;
        this.status = "ACTIVE";
        this.operations = [];
        this.createdAt = Date.now();
    }

    addOperation(operation) {
        if (this.status !== "ACTIVE") {
            throw new Error(
                `Cannot add operation to transaction with status: ${this.status}`
            );
        }

        this.operations.push(operation);
    }

    commit() {
        if (this.status !== "ACTIVE") {
            throw new Error(
                `Transaction cannot commit from status: ${this.status}`
            );
        }

        this.status = "COMMITTED";
    }

    rollback() {
        if (this.status !== "ACTIVE") {
            throw new Error(
                `Transaction cannot rollback from status: ${this.status}`
            );
        }

        this.status = "ROLLED_BACK";
    }
}

module.exports = TransactionContext;