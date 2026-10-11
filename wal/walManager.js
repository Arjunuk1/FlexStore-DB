const fs = require("fs");
const path = require("path");

class WALManager {
    constructor(dataDirectory) {
        fs.mkdirSync(dataDirectory, { recursive: true });
        this.filePath = path.join(dataDirectory, "wal.log");
        this.sequencePath = path.join(dataDirectory, "wal.sequence");
        const records = this.readAll();
        const persisted = Number(fs.existsSync(this.sequencePath) ? fs.readFileSync(this.sequencePath, "utf8") : 0) || 0;
        this.nextLSN = Math.max(persisted, ...records.map(record => record.lsn || 0), 0) + 1;
    }

    append(entry) {
        return this.withLock(() => {
            const highest = this.readAll().reduce((value, record) => Math.max(value, record.lsn || 0), 0);
            const persisted = Number(fs.existsSync(this.sequencePath) ? fs.readFileSync(this.sequencePath, "utf8") : 0) || 0;
            const lsn = Math.max(this.nextLSN - 1, highest, persisted) + 1;
            const record = { lsn, timestamp: new Date().toISOString(), ...entry };
            const descriptor = fs.openSync(this.filePath, "a");
            try {
                fs.writeSync(descriptor, `${JSON.stringify(record)}\n`, null, "utf8");
                fs.fsyncSync(descriptor);
            } finally {
                fs.closeSync(descriptor);
            }
            fs.writeFileSync(this.sequencePath, String(lsn), "utf8");
            this.nextLSN = lsn + 1;
            return record;
        });
    }

    withLock(action) {
        const lockPath = `${this.filePath}.lock`;
        let descriptor;
        try {
            for (;;) {
                try { descriptor = fs.openSync(lockPath, "wx"); break; } catch (error) {
                    if (error.code !== "EEXIST") throw error;
                    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
                }
            }
            return action();
        } finally {
            if (descriptor !== undefined) fs.closeSync(descriptor);
            if (descriptor !== undefined) fs.rmSync(lockPath, { force: true });
        }
    }

    readAll() {
        if (!fs.existsSync(this.filePath)) {
            return [];
        }

        return fs.readFileSync(this.filePath, "utf8")
            .split("\n")
            .filter(line => line.trim())
            .flatMap((line, index, lines) => {
                try {
                    return [JSON.parse(line)];
                } catch (error) {
                    if (index === lines.length - 1 && !fs.readFileSync(this.filePath, "utf8").endsWith("\n")) return [];
                    throw new Error(`WAL corruption at record ${index + 1}: ${error.message}`);
                }
            });
    }

    clear() {
        this.withLock(() => {
            fs.writeFileSync(this.filePath, "", "utf8");
            const persisted = Number(fs.existsSync(this.sequencePath) ? fs.readFileSync(this.sequencePath, "utf8") : 0) || this.nextLSN - 1;
            this.nextLSN = persisted + 1;
        });
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