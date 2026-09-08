const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const Database = require("../core/database");
const TransactionContext = require("../transactions/transactionContext");
const WALManager = require("../wal/walManager");

function createDatabase() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "flexstore-txn-"));
    const database = new Database(directory, path.join(directory, "schemas"));

    return { database, directory };
}

test("transaction stages operations and rollback leaves storage unchanged", () => {
    const { database, directory } = createDatabase();

    try {
        const users = database.collection("users");
        users.insert({ id: 1, name: "Existing" });

        const transaction = database.beginTransaction();
        transaction.insert("users", { id: 2, name: "Staged" });

        assert.deepEqual(users.findAll(), [{ id: 1, name: "Existing" }]);
        assert.deepEqual(transaction.rollback(), {
            transactionId: transaction.id,
            status: "ROLLED_BACK"
        });
        assert.deepEqual(users.findAll(), [{ id: 1, name: "Existing" }]);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("transaction commit applies operations and keeps indexes synchronized", () => {
    const { database, directory } = createDatabase();

    try {
        const users = database.collection("users");
        users.createIndex("email");

        const transaction = database.beginTransaction();
        transaction
            .insert("users", { id: 1, email: "old@example.com" })
            .update("users", { id: 1 }, { $set: { email: "new@example.com" } });

        assert.deepEqual(transaction.commit(), {
            transactionId: transaction.id,
            status: "COMMITTED"
        });
        assert.deepEqual(users.findAll(), [{ id: 1, email: "new@example.com" }]);
        assert.deepEqual(users.indexManager.getIndex("email").find("new@example.com"), [1]);
        assert.deepEqual(users.indexManager.getIndex("email").find("old@example.com"), []);
        assert.deepEqual(
            new WALManager(directory).readAll().map(entry => entry.type),
            ["BEGIN", "SNAPSHOT", "INSERT", "UPDATE", "COMMIT"]
        );
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("failed transaction restores earlier writes and indexes", () => {
    const { database, directory } = createDatabase();

    try {
        const users = database.collection("users");
        users.createIndex("email", { unique: true });
        users.insert({ id: 1, email: "one@example.com" });

        const transaction = database.beginTransaction();
        transaction
            .insert("users", { id: 2, email: "two@example.com" })
            .addOperation({ type: "INVALID", collection: "users" });

        assert.throws(() => transaction.commit(), /Unknown transaction operation/);
        assert.deepEqual(users.findAll(), [{ id: 1, email: "one@example.com" }]);
        assert.deepEqual(users.indexManager.getIndex("email").find("one@example.com"), [1]);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("database recovery restores an incomplete transaction snapshot", () => {
    const { database, directory } = createDatabase();

    try {
        const users = database.collection("users");
        users.insert({ id: 1, name: "Original" });
        const wal = new WALManager(directory);
        wal.append({ transactionId: "txn_crash", type: "BEGIN" });
        wal.append({
            transactionId: "txn_crash",
            type: "SNAPSHOT",
            collection: "users",
            documents: [{ id: 1, name: "Original" }]
        });
        users.insert({ id: 2, name: "Uncommitted" });

        const recovered = new Database(directory, path.join(directory, "schemas"));
        assert.deepEqual(recovered.collection("users").findAll(), [
            { id: 1, name: "Original" }
        ]);
        assert.deepEqual(wal.readAll(), []);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("transaction context enforces its lifecycle", () => {
    const context = new TransactionContext("txn_1");
    context.addOperation({ type: "INSERT" });
    context.commit();

    assert.throws(() => context.addOperation({ type: "DELETE" }), /COMMITTED/);
    assert.throws(() => context.rollback(), /COMMITTED/);
});
