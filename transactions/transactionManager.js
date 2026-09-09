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
        this.walManager = new WALManager(dataDirectory);
        this.wal = this.walManager;
    }

    begin() {
        const transaction = new Transaction(this.database, this);
        this.transactions.set(transaction.id, transaction);
        this.walManager.append({ transactionId: transaction.id, type: "BEGIN" });
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

        transaction.status = "ROLLED_BACK";
        transaction.rolledBackAt = Date.now();
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

        const preparedOperations = [];
        const states = new Map();
        const appliedOperations = [];

        try {
            for (const operation of transaction.operations) {
                preparedOperations.push(this.prepareOperation(operation, states));
            }

            for (const prepared of preparedOperations) {
                this.walManager.append({
                    transactionId: transaction.id,
                    type: "OPERATION",
                    operation: prepared.operation,
                    undo: prepared.undo
                });
            }

            for (const prepared of preparedOperations) {
                this.applyOperation(prepared.operation);
                appliedOperations.push(prepared);
            }

            this.walManager.append({ transactionId: transaction.id, type: "COMMIT" });
            transaction.status = "COMMITTED";
            transaction.committedAt = Date.now();
            this.transactions.delete(transaction.id);

            return { transactionId: transaction.id, status: transaction.status };
        } catch (error) {
            let undoFailed = false;

            for (let index = appliedOperations.length - 1; index >= 0; index -= 1) {
                try {
                    this.undoOperation(appliedOperations[index].undo);
                } catch (undoError) {
                    undoFailed = true;
                    error.undoError = undoError;
                }
            }

            this.walManager.append({ transactionId: transaction.id, type: "ROLLBACK" });
            transaction.status = undoFailed ? "FAILED" : "ROLLED_BACK";
            transaction.rolledBackAt = undoFailed ? null : Date.now();
            this.transactions.delete(transaction.id);
            throw error;
        }
    }

    prepareOperation(operation, states = new Map()) {
        const collection = this.database.collection(operation.collection);
        const documents = states.has(operation.collection)
            ? states.get(operation.collection)
            : clone(collection.findAll());
        states.set(operation.collection, documents);

        switch (operation.type) {
            case "INSERT": {
                documents.push(clone(operation.document));
                return {
                    operation,
                    undo: {
                        type: "DELETE",
                        collection: operation.collection,
                        id: operation.document.id
                    }
                };
            }
            case "UPDATE": {
                const matched = documents.filter(document =>
                    this.matchesFilter(document, operation.filter)
                );

                if (matched.length === 0) {
                    throw new Error("Transaction update matched no documents");
                }

                for (const document of matched) {
                    const updated = collection.applyUpdate(document, operation.update);
                    documents[documents.findIndex(item => item.id === document.id)] = clone(updated);
                }

                return {
                    operation,
                    undo: {
                        type: "RESTORE_MANY",
                        collection: operation.collection,
                        documents: clone(matched)
                    }
                };
            }
            case "DELETE": {
                const matched = documents.filter(document =>
                    this.matchesFilter(document, operation.filter)
                );
                states.set(
                    operation.collection,
                    documents.filter(document => !matched.includes(document))
                );

                return {
                    operation,
                    undo: {
                        type: "RESTORE_MANY",
                        collection: operation.collection,
                        documents: clone(matched)
                    }
                };
            }
            default:
                throw new Error(`Unknown transaction operation: ${operation.type}`);
        }
    }

    undoOperation(undo) {
        const collection = this.database.collection(undo.collection);

        switch (undo.type) {
            case "DELETE":
                collection.deleteById(undo.id);
                return;
            case "RESTORE":
                this.restoreDocument(collection, undo.document);
                return;
            case "RESTORE_MANY":
                for (const document of undo.documents) {
                    this.restoreDocument(collection, document);
                }
                return;
            default:
                throw new Error(`Unknown undo operation: ${undo.type}`);
        }
    }

    restoreDocument(collection, document) {
        const existing = collection.find({ id: document.id }).exec();

        if (existing.length > 0) {
            collection.updateById(document.id, document);
        } else {
            collection.insert(document);
        }
    }

    matchesFilter(document, filter = {}) {
        return Object.entries(filter).every(([field, condition]) => {
            const value = document[field];

            if (condition && typeof condition === "object" && !Array.isArray(condition)) {
                return Object.entries(condition).every(([operator, expected]) => {
                    if (operator === "$gt") return value > expected;
                    if (operator === "$gte") return value >= expected;
                    if (operator === "$lt") return value < expected;
                    if (operator === "$lte") return value <= expected;
                    if (operator === "$in") return expected.includes(value);
                    if (operator === "$ne") return value !== expected;
                    return false;
                });
            }

            return value === condition;
        });
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

    listActiveTransactions() {
        return Array.from(this.transactions.values()).map(transaction => transaction.getInfo());
    }

    checkpoint() {
        this.walManager.append({ type: "CHECKPOINT" });
        this.walManager.clear();
    }
}

module.exports = TransactionManager;