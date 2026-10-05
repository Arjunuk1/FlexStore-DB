const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const Collection = require("../core/collection");
const HashIndex = require("../index/hashIndex");
const IndexManager = require("../index/indexManager");
const Database = require("../core/database");

function createCollection(initialDocuments = []) {
    let documents = [...initialDocuments];
    const storage = {
        read() {
            return documents;
        },
        write(nextDocuments) {
            documents = nextDocuments;
        }
    };

    return { collection: new Collection("users", storage), storage };
}

test("unique hash indexes reject duplicates and expose metadata", () => {
    const index = new HashIndex("email", { unique: true });
    index.insert({ id: 1, email: "arjun@gmail.com" });

    assert.throws(
        () => index.insert({ id: 2, email: "arjun@gmail.com" }),
        /Duplicate value for unique index on "email"/
    );
    assert.deepEqual(index.getMetadata(), {
        field: "email",
        unique: true,
        type: "hash",
        entries: 1
    });
});

test("index manager returns metadata and reports successful drops", () => {
    const manager = new IndexManager();
    manager.createIndex("email", { unique: true });

    assert.deepEqual(manager.listIndexes(), [{
        field: "email",
        unique: true,
        type: "hash",
        entries: 0
    }]);
    assert.equal(manager.dropIndex("email"), true);
});

test("collection rejects duplicate unique inserts without writing the document", () => {
    const { collection, storage } = createCollection([{ id: 1, email: "a@example.com" }]);
    collection.createIndex("email", { unique: true });

    assert.throws(
        () => collection.insert({ id: 2, email: "a@example.com" }),
        /Duplicate value for unique index/
    );
    assert.deepEqual(storage.read(), [{ id: 1, email: "a@example.com" }]);
    assert.deepEqual(collection.indexManager.getIndex("email").find("a@example.com"), [1]);
});

test("collection rolls back a duplicate update and cleans up a failed unique index build", () => {
    const { collection, storage } = createCollection([
        { id: 1, email: "a@example.com" },
        { id: 2, email: "b@example.com" }
    ]);
    collection.createIndex("email", { unique: true });

    assert.throws(
        () => collection.updateById(2, { id: 2, email: "a@example.com" }),
        /Duplicate value for unique index/
    );
    assert.deepEqual(storage.read(), [
        { id: 1, email: "a@example.com" },
        { id: 2, email: "b@example.com" }
    ]);
    assert.deepEqual(collection.indexManager.getIndex("email").find("b@example.com"), [2]);

    const duplicateCollection = createCollection([
        { id: 3, email: "same@example.com" },
        { id: 4, email: "same@example.com" }
    ]).collection;
    assert.throws(
        () => duplicateCollection.createIndex("email", { unique: true }),
        /Duplicate value for unique index/
    );
    assert.deepEqual(duplicateCollection.listIndexes(), []);
});

test("database restores index metadata after reopening", () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "flexstore-index-persistence-"));
    const dataDirectory = path.join(temporaryDirectory, "data");
    const schemaDirectory = path.join(temporaryDirectory, "schemas");

    try {
        const database = new Database(dataDirectory, schemaDirectory);
        const users = database.collection("users");
        users.insert({ id: 1, email: "a@example.com" });
        users.createIndex("email", { unique: true });

        const reopened = new Database(dataDirectory, schemaDirectory);
        const restored = reopened.collection("users");
        assert.deepEqual(restored.listIndexes(), [{ field: "email", unique: true, type: "hash", entries: 1 }]);
        assert.deepEqual(restored.find({ email: "a@example.com" }).explain().plan.type, "INDEX_SCAN");
    } finally {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});
