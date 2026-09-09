const fs = require("fs");
const path = require("path");

class WALManager {
    constructor(dataDirectory) {
        fs.mkdirSync(dataDirectory, { recursive: true });
        this.filePath = path.join(dataDirectory, "wal.log");
        const records = this.readAll();
        this.nextLSN = records.reduce(
            (highest, record) => Math.max(highest, record.lsn || 0),
            0
        ) + 1;
    }

    append(entry) {
        const record = {
            lsn: this.nextLSN++,
            timestamp: new Date().toISOString(),
            ...entry
        };
        const descriptor = fs.openSync(this.filePath, "a");

        try {
            fs.writeSync(descriptor, `${JSON.stringify(record)}\n`, null, "utf8");
            fs.fsyncSync(descriptor);
        } finally {
            fs.closeSync(descriptor);
        }

        return record;
    }

    readAll() {
        if (!fs.existsSync(this.filePath)) {
            return [];
        }

        return fs.readFileSync(this.filePath, "utf8")
            .split("\n")
            .filter(line => line.trim())
            .flatMap(line => {
                try {
                    return [JSON.parse(line)];
                } catch {
                    return [];
                }
            });
    }

    clear() {
        fs.writeFileSync(this.filePath, "", "utf8");
        this.nextLSN = 1;
    }

    getPendingTransactions() {
        const transactions = new Map();

        for (const record of this.readAll()) {
            if (!record.transactionId) {
                continue;
            }

            if (!transactions.has(record.transactionId)) {
                transactions.set(record.transactionId, []);
            }

            transactions.get(record.transactionId).push(record);
        }

        return transactions;
    }
}

module.exports = WALManager;