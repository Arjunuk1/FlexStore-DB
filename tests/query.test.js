const assert = require("node:assert/strict");
const test = require("node:test");

const Collection = require("../core/collection");

const documents = [
    {
        name: "Arjun",
        age: 19,
        email: "arjun@example.com",
        address: { city: "Rajpura", country: "India" }
    },
    { name: "Ayush", age: 22, email: "ayush@example.com" },
    { name: "Rahul", age: 18, email: "rahul@example.com" },
    { name: "Karan", age: 25, email: "karan@example.com" },
    { name: "Aman", age: 22, email: "aman@example.com" }
];

function createQuery(filter = {}) {
    const storage = {
        read() {
            return documents;
        }
    };
    const users = new Collection("users", storage);

    return users.find(filter);
}

test("sorts ascending and descending without mutating the source array", () => {
    const originalOrder = documents.map(document => document.name);

    assert.deepEqual(
        createQuery().sort({ age: 1 }).exec().map(document => document.name),
        ["Rahul", "Arjun", "Ayush", "Aman", "Karan"]
    );
    assert.deepEqual(
        createQuery().sort({ age: -1 }).exec().map(document => document.name),
        ["Karan", "Ayush", "Aman", "Arjun", "Rahul"]
    );
    assert.deepEqual(documents.map(document => document.name), originalOrder);
});

test("uses subsequent sort fields to break ties", () => {
    assert.deepEqual(
        createQuery()
            .sort({ age: 1, name: 1 })
            .exec()
            .map(document => document.name),
        ["Rahul", "Arjun", "Aman", "Ayush", "Karan"]
    );
});

test("skips and limits result documents", () => {
    assert.deepEqual(
        createQuery().sort({ age: 1 }).skip(2).exec().map(document => document.age),
        [22, 22, 25]
    );
    assert.deepEqual(
        createQuery().sort({ age: 1 }).limit(2).exec().map(document => document.age),
        [18, 19]
    );
});

test("projects requested fields, including dotted field names", () => {
    assert.deepEqual(
        createQuery({ name: "Arjun" }).select(["name", "address.city"]).exec(),
        [{ name: "Arjun", "address.city": "Rajpura" }]
    );
});

test("executes the filter, sort, skip, limit, and projection pipeline in order", () => {
    assert.deepEqual(
        createQuery({ age: { $gte: 18 } })
            .sort({ age: -1 })
            .skip(1)
            .limit(2)
            .select(["name", "age"])
            .exec(),
        [
            { name: "Ayush", age: 22 },
            { name: "Aman", age: 22 }
        ]
    );
});

test("rejects invalid query builder options", () => {
    assert.throws(() => createQuery().skip(-1), /skip must be a non-negative integer/);
    assert.throws(() => createQuery().skip("hello"), /skip must be a non-negative integer/);
    assert.throws(() => createQuery().limit(-500), /limit must be a non-negative integer/);
    assert.throws(() => createQuery().sort({ age: 0 }), /sort directions must be either 1 or -1/);
    assert.throws(() => createQuery().select("name"), /select must be an array of field names/);
});

test("uses indexed candidates while preserving the query builder pipeline", () => {
    const indexedDocuments = [
        { id: 1, name: "Arjun", age: 19, email: "arjun@gmail.com" },
        { id: 2, name: "Ayush", age: 22, email: "ayush@gmail.com" },
        { id: 3, name: "Arjun", age: 25, email: "arjun@gmail.com" }
    ];
    const storage = {
        read() {
            return indexedDocuments;
        }
    };
    const users = new Collection("users", storage);
    users.createIndex("email");

    let candidates;
    const find = users.queryEngine.find.bind(users.queryEngine);
    users.queryEngine.find = (candidateDocuments, filter) => {
        candidates = candidateDocuments;
        return find(candidateDocuments, filter);
    };

    const query = users.find({ email: "arjun@gmail.com" });

    assert.deepEqual(query.explain(), {
        type: "INDEX_SCAN",
        field: "email",
        value: "arjun@gmail.com"
    });
    assert.deepEqual(
        query
            .sort({ age: -1 })
            .limit(1)
            .select(["name", "email", "age"])
            .exec(),
        [{ name: "Arjun", email: "arjun@gmail.com", age: 25 }]
    );
    assert.deepEqual(candidates, [indexedDocuments[0], indexedDocuments[2]]);
});
