class RecoveryManager {
    constructor(database, walManager) {
        this.database = database;
        this.walManager = walManager;
    }

    recover() {
        const transactions = new Map();

        for (const entry of this.walManager.readAll()) {
            if (!transactions.has(entry.transactionId)) {
                transactions.set(entry.transactionId, []);
            }

            transactions.get(entry.transactionId).push(entry);
        }

        for (const entries of transactions.values()) {
            if (entries.some(entry => entry.type === "COMMIT")) {
                continue;
            }

            for (const entry of entries.filter(item => item.type === "SNAPSHOT")) {
                this.database.collection(entry.collection).replaceDocuments(
                    entry.documents
                );
            }
        }

        this.walManager.clear();
    }
}

module.exports = RecoveryManager;