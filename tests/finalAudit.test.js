const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const Database = require("../core/database");
const DatabaseManager = require("../core/databaseManager");
const WALManager = require("../wal/walManager");

function temporaryDatabase() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "flexstore-audit-"));
    return {
        directory,
        database: new Database(path.join(directory, "data"), path.join(directory, "schemas"))
    };
}

test("empty collections persist, list, reopen, and delete", () => {
    const { directory, database } = temporaryDatabase();
    try {
        assert.deepEqual(database.createCollection("empty"), { name: "empty", created: true });
        assert.deepEqual(database.listCollections(), ["empty"]);
        const reopened = new Database(path.join(directory, "data"), path.join(directory, "schemas"));
        assert.deepEqual(reopened.listCollections(), ["empty"]);
        assert.deepEqual(reopened.dropCollection("empty"), { name: "empty", deleted: true });
        assert.deepEqual(reopened.listCollections(), []);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("dropping a schema-backed collection removes schema and old schema does not return", () => {
    const { directory, database } = temporaryDatabase();
    try {
        database.createCollection("users");
        database.updateSchema("users", { email: { type: "string", required: true } });
        database.dropCollection("users");
        assert.equal(database.getSchema("users"), null);
        database.createCollection("users");
        assert.equal(database.getSchema("users"), null);
        assert.doesNotThrow(() => database.collection("users").insert({ id: 1 }));
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("separate managers observe database, collection, document, and index changes", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "flexstore-managers-"));
    const dataPath = path.join(directory, "data");
    const schemaPath = path.join(directory, "schemas");
    try {
        const first = new DatabaseManager(dataPath, schemaPath);
        const second = new DatabaseManager(dataPath, schemaPath);
        first.createDatabase("shared");
        assert.deepEqual(second.listDatabases(), ["shared"]);
        first.getDatabase("shared").createCollection("items");
        assert.deepEqual(second.getDatabase("shared").listCollections(), ["items"]);
        first.getDatabase("shared").collection("items").insert({ id: 1, value: "one" });
        second.getDatabase("shared").collection("items").createIndex("value");
        assert.deepEqual(second.getDatabase("shared").collection("items").find({ value: "one" }).exec(), [{ id: 1, value: "one" }]);
        assert.equal(second.getDatabase("shared").collection("items").find({ value: "one" }).explain().plan.type, "INDEX_SCAN");
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("checkpoint rejects active transactions and preserves increasing LSNs", () => {
    const { directory, database } = temporaryDatabase();
    try {
        const transaction = database.beginTransaction();
        assert.throws(() => database.transactionManager.checkpoint(), /active/);
        transaction.rollback();
        database.transactionManager.checkpoint();
        const wal = new WALManager(path.join(directory, "data"));
        const record = wal.append({ type: "AFTER_CHECKPOINT" });
        assert.equal(record.lsn, 4);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("WAL ignores an incomplete trailing record but rejects malformed complete records", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "flexstore-wal-"));
    try {
        const filePath = path.join(directory, "wal.log");
        fs.writeFileSync(filePath, `${JSON.stringify({ lsn: 1, type: "BEGIN" })}\n{"lsn":`);
        assert.deepEqual(new WALManager(directory).readAll().map(record => record.lsn), [1]);
        fs.writeFileSync(filePath, "not-json\n");
        assert.throws(() => new WALManager(directory), /WAL corruption/);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
