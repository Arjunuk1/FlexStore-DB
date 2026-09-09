class RecoveryManager {
    constructor(database, walManager) {
        this.database = database;
        this.walManager = walManager;
    }

    recover() {
        const transactions = this.walManager.getPendingTransactions();

        for (const entries of transactions.values()) {
            if (entries.some(entry => ["COMMIT", "ROLLBACK", "RECOVERY_ROLLBACK"].includes(entry.type))) {
                continue;
            }

            for (const entry of entries
                .filter(item => item.type === "OPERATION")
                .reverse()) {
                this.undoOperation(entry.undo);
            }

            for (const entry of entries.filter(item => item.type === "SNAPSHOT")) {
                this.database.collection(entry.collection).replaceDocuments(entry.documents);
            }

            this.walManager.append({
                transactionId: entries[0].transactionId,
                type: "RECOVERY_ROLLBACK"
            });
        }
    }

    undoOperation(undo) {
        const collection = this.database.collection(undo.collection);

        if (undo.type === "DELETE") {
            collection.deleteById(undo.id);
            return;
        }

        if (undo.type === "RESTORE" || undo.type === "RESTORE_MANY") {
            const documents = undo.type === "RESTORE" ? [undo.document] : undo.documents;

            for (const document of documents) {
                const existing = collection.find({ id: document.id }).exec();

                if (existing.length > 0) {
                    collection.updateById(document.id, document);
                } else {
                    collection.insert(document);
                }
            }
            return;
        }

        throw new Error(`Unknown recovery undo type: ${undo.type}`);
    }
}

module.exports = RecoveryManager;