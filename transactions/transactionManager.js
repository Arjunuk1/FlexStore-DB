const Transaction = require("./transaction");
const WALManager = require("../wal/walManager");
const RecoveryManager = require("../wal/recoveryManager");

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

class TransactionManager {
    constructor(database, dataDirectory) {
        this.database = database;
        this.transactions = new Map();
        this.transactionCounter = 0;
        this.walManager = new WALManager(dataDirectory);
    }

    begin() {
        const id = `txn_${++this.transactionCounter}`;
        const transaction = new Transaction(id, this.database, this);
        this.transactions.set(id, transaction);
        this.walManager.append({ transactionId: id, type: "BEGIN" });
        return transaction;
    }

    getTransaction(id) {
        return this.transactions.get(id);
    }

    rollback(transaction) {
        if (transaction.status !== "ACTIVE") {
            throw new Error(
                `Cannot rollback transaction with status: ${transaction.status}`
            );
        }

        transaction.operations = [];
        transaction.status = "ROLLED_BACK";
        this.walManager.append({
            transactionId: transaction.id,
            type: "ROLLBACK"
        });
        this.transactions.delete(transaction.id);

        return { transactionId: transaction.id, status: transaction.status };
    }

    commit(transaction) {
        if (transaction.status !== "ACTIVE") {
            throw new Error(
                `Cannot commit transaction with status: ${transaction.status}`
            );
        }

        const snapshots = new Map();

        try {
            for (const operation of transaction.operations) {
                if (!snapshots.has(operation.collection)) {
                    const collection = this.database.collection(operation.collection);
                    snapshots.set(operation.collection, clone(collection.findAll()));
                    this.walManager.append({
                        transactionId: transaction.id,
                        type: "SNAPSHOT",
                        collection: operation.collection,
                        documents: snapshots.get(operation.collection)
                    });
                }

                this.walManager.append({ transactionId: transaction.id, ...operation });
            }

            for (const operation of transaction.operations) {
                this.applyOperation(operation);
            }

            this.walManager.append({ transactionId: transaction.id, type: "COMMIT" });
            transaction.status = "COMMITTED";
            this.transactions.delete(transaction.id);

            return { transactionId: transaction.id, status: transaction.status };
        } catch (error) {
            for (const [name, documents] of snapshots) {
                this.database.collection(name).replaceDocuments(documents);
            }

            this.walManager.append({ transactionId: transaction.id, type: "ROLLBACK" });
            transaction.status = "FAILED";
            this.transactions.delete(transaction.id);
            throw error;
        }
    }

    applyOperation(operation) {
        const collection = this.database.collection(operation.collection);

        switch (operation.type) {
            case "INSERT":
                collection.insert(operation.document);
                return;
            case "UPDATE":
                collection.update(operation.filter, operation.update);
                return;
            case "DELETE":
                collection.delete(operation.filter);
                return;
            default:
                throw new Error(`Unknown transaction operation: ${operation.type}`);
        }
    }

    recover() {
        new RecoveryManager(this.database, this.walManager).recover();
    }
}

module.exports = TransactionManager;