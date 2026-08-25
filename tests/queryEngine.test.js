const assert = require("node:assert/strict");
const test = require("node:test");

const Collection = require("../core/collection");
const QueryEngine = require("../query/queryEngine");

const engine = new QueryEngine();
const documents = [
    { name: "Arjun", age: 19, active: true },
    { name: "Ayush", age: 21, active: true },
    { name: "Rahul", age: 16, active: false }
];

test("matches equality and comparison operators", () => {
    assert.deepEqual(engine.find(documents, { age: { $eq: 19 } }), [documents[0]]);
    assert.deepEqual(engine.find(documents, { age: { $ne: 19 } }), [documents[1], documents[2]]);
    assert.deepEqual(engine.find(documents, { age: { $gt: 18 } }), [documents[0], documents[1]]);
    assert.deepEqual(engine.find(documents, { age: { $gte: 19 } }), [documents[0], documents[1]]);
    assert.deepEqual(engine.find(documents, { age: { $lt: 20 } }), [documents[0], documents[2]]);
    assert.deepEqual(engine.find(documents, { age: { $lte: 19 } }), [documents[0], documents[2]]);
    assert.deepEqual(engine.find(documents, { active: true }), [documents[0], documents[1]]);
});

test("matches array and existence operators", () => {
    assert.deepEqual(engine.find(documents, { age: { $in: [16, 19] } }), [documents[0], documents[2]]);
    assert.deepEqual(engine.find(documents, { age: { $nin: [16, 19] } }), [documents[1]]);
    assert.deepEqual(engine.find(documents, { email: { $exists: true } }), []);
    assert.deepEqual(engine.find(documents, { email: { $exists: false } }), documents);
});

test("rejects invalid and unsupported field operators", () => {
    assert.throws(() => engine.find(documents, null), /Query conditions must be an object/);
    assert.throws(() => engine.find(documents, []), /Query conditions must be an object/);
    assert.throws(() => engine.find(documents, { age: { $in: 19 } }), /\$in expects an array/);
    assert.throws(() => engine.find(documents, { age: { $regex: "Arjun" } }), /Unsupported query operator/);
});

test("matches logical operators", () => {
    assert.deepEqual(
        engine.find(documents, {
            $and: [{ age: { $gt: 18 } }, { active: true }]
        }),
        [documents[0], documents[1]]
    );
    assert.deepEqual(
        engine.find(documents, {
            $or: [{ age: { $lt: 18 } }, { age: { $gt: 20 } }]
        }),
        [documents[1], documents[2]]
    );
    assert.deepEqual(
        engine.find(documents, { $not: { active: true } }),
        [documents[2]]
    );
    assert.throws(
        () => engine.find(documents, { $or: { active: true } }),
        /\$or expects an array/
    );
    assert.throws(
        () => engine.find(documents, { $not: null }),
        /Query conditions must be an object/
    );
});

test("matches nested fields", () => {
    const nestedDocuments = [
        { name: "Arjun", address: { city: "Rajpura", country: "India" } },
        { name: "Ayush", address: { city: "Chandigarh", country: "India" } }
    ];

    assert.deepEqual(
        engine.find(nestedDocuments, { "address.city": "Rajpura" }),
        [nestedDocuments[0]]
    );
});

test("collection delegates filtered finds to the query engine", () => {
    const storage = {
        read() {
            return documents;
        }
    };
    const users = new Collection("users", storage);

    assert.deepEqual(users.find({ age: { $gte: 21 } }), [documents[1]]);
    assert.deepEqual(users.find(), documents);
});
