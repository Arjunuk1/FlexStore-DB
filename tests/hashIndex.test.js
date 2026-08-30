const assert = require("node:assert/strict");
const test = require("node:test");

const Collection = require("../core/collection");
const HashIndex = require("../index/hashIndex");
const IndexManager = require("../index/indexManager");

test("hash index finds duplicate field values and removes document IDs", () => {
    const index = new HashIndex("email");
    const arjun = { id: 1, email: "arjun@gmail.com" };
    const anotherArjun = { id: 4, email: "arjun@gmail.com" };

    index.insert(arjun);
    index.insert({ id: 2, email: "rahul@gmail.com" });
    index.insert(anotherArjun);

    assert.deepEqual(index.find("arjun@gmail.com"), [1, 4]);
    assert.deepEqual(index.find("rahul@gmail.com"), [2]);
    assert.deepEqual(index.find("unknown@gmail.com"), []);

    index.remove(arjun);
    assert.deepEqual(index.find("arjun@gmail.com"), [4]);

    index.remove(anotherArjun);
    assert.deepEqual(index.find("arjun@gmail.com"), []);
});

test("hash index supports dotted paths and ignores missing indexed values", () => {
    const index = new HashIndex("address.city");

    index.insert({ id: 1, address: { city: "Rajpura" } });
    index.insert({ id: 2, address: { city: "Delhi" } });
    index.insert({ id: 3, address: {} });

    assert.deepEqual(index.find("Rajpura"), [1]);
    assert.deepEqual(index.find("Delhi"), [2]);
    assert.deepEqual(index.find(undefined), []);
});

test("index manager creates, lists, and drops indexes", () => {
    const manager = new IndexManager();

    manager.createIndex("email");

    assert.equal(manager.hasIndex("email"), true);
    assert.deepEqual(manager.listIndexes(), ["email"]);
    assert.throws(() => manager.createIndex("email"), /Index already exists/);

    manager.dropIndex("email");

    assert.equal(manager.hasIndex("email"), false);
    assert.throws(() => manager.dropIndex("email"), /Index does not exist/);
});

test("collection keeps indexes synchronized on insert, update, and delete", () => {
    let documents = [{ id: 1, email: "arjun@gmail.com" }];
    const storage = {
        read() {
            return documents;
        },
        write(nextDocuments) {
            documents = nextDocuments;
        }
    };
    const users = new Collection("users", storage);

    assert.deepEqual(users.createIndex("email"), {
        field: "email",
        type: "hash"
    });

    const index = users.indexManager.getIndex("email");
    assert.deepEqual(index.find("arjun@gmail.com"), [1]);

    users.insert({ id: 2, email: "test@gmail.com" });
    assert.deepEqual(index.find("test@gmail.com"), [2]);

    users.updateById(1, { id: 1, email: "new@gmail.com" });
    assert.deepEqual(index.find("arjun@gmail.com"), []);
    assert.deepEqual(index.find("new@gmail.com"), [1]);

    users.deleteById(1);
    assert.deepEqual(index.find("new@gmail.com"), []);
    assert.deepEqual(documents, [{ id: 2, email: "test@gmail.com" }]);
});
