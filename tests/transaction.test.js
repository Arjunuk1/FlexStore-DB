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
            ["BEGIN", "OPERATION", "OPERATION", "COMMIT"]
        );
        assert.deepEqual(
            new WALManager(directory).readAll().map(entry => entry.lsn),
            [1, 2, 3, 4]
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
        assert.equal(wal.readAll().at(-1).type, "RECOVERY_ROLLBACK");
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

test("constraint failure rolls back every applied operation", () => {
    const { database, directory } = createDatabase();

    try {
        const users = database.collection("users");
        users.createIndex("email", { unique: true });
        users.insert({ id: 1, email: "taken@example.com" });

        const transaction = database.beginTransaction();
        transaction
            .insert("users", { id: 2, email: "new@example.com" })
            .insert("users", { id: 3, email: "taken@example.com" });

        assert.throws(() => transaction.commit(), /unique|duplicate/i);
        assert.deepEqual(users.findAll(), [{ id: 1, email: "taken@example.com" }]);
        assert.equal(transaction.status, "ROLLED_BACK");
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("recovery undoes incomplete insert, update, and delete operations", () => {
    const { database, directory } = createDatabase();

    try {
        const users = database.collection("users");
        users.insert({ id: 1, name: "Original" });
        users.insert({ id: 2, name: "To delete" });
        const wal = new WALManager(directory);

        wal.append({ transactionId: "txn_insert", type: "BEGIN" });
        wal.append({
            transactionId: "txn_insert",
            type: "OPERATION",
            operation: { type: "INSERT", collection: "users", document: { id: 3, name: "Inserted" } },
            undo: { type: "DELETE", collection: "users", id: 3 }
        });
        users.insert({ id: 3, name: "Inserted" });

        wal.append({ transactionId: "txn_update", type: "BEGIN" });
        wal.append({
            transactionId: "txn_update",
            type: "OPERATION",
            operation: { type: "UPDATE", collection: "users", filter: { id: 1 }, update: { $set: { name: "Changed" } } },
            undo: { type: "RESTORE_MANY", collection: "users", documents: [{ id: 1, name: "Original" }] }
        });
        users.updateById(1, { id: 1, name: "Changed" });

        wal.append({ transactionId: "txn_delete", type: "BEGIN" });
        wal.append({
            transactionId: "txn_delete",
            type: "OPERATION",
            operation: { type: "DELETE", collection: "users", filter: { id: 2 } },
            undo: { type: "RESTORE_MANY", collection: "users", documents: [{ id: 2, name: "To delete" }] }
        });
        users.deleteById(2);

        const recovered = new Database(directory, path.join(directory, "schemas"));
        assert.deepEqual(recovered.collection("users").findAll(), [
            { id: 1, name: "Original" },
            { id: 2, name: "To delete" }
        ]);
        assert.equal(new WALManager(directory).readAll().filter(entry => entry.type === "RECOVERY_ROLLBACK").length, 3);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
