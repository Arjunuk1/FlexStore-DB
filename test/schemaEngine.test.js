const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const Collection = require("../core/collection");
const Database = require("../core/database");
const SchemaValidator = require("../schema/schemaValidator");

test("validates a document using its schema", () => {
    const validator = new SchemaValidator({
        name: { type: "string", required: true },
        age: { type: "integer", required: false },
        cgpa: { type: "number", min: 0, max: 10 }
    });

    assert.deepEqual(
        validator.validate({ name: "Test User", age: 20, cgpa: 8.82 }),
        { valid: true, errors: [] }
    );
});

test("rejects invalid documents before collection storage", () => {
    const storage = {
        documents: [],
        read() {
            return this.documents;
        },
        write(documents) {
            this.documents = documents;
        }
    };
    const validator = new SchemaValidator({
        name: { type: "string", required: true },
        email: { type: "string", required: true },
        age: { type: "integer", required: false }
    });
    const users = new Collection("users", storage, validator);

    assert.throws(
        () => users.insert({ name: 123, email: "test@gmail.com", age: "twenty" }),
        error => {
            assert.equal(error.message, "Document validation failed");
            assert.deepEqual(error.details, [
                "name must be of type string",
                "age must be of type integer"
            ]);
            return true;
        }
    );
    assert.deepEqual(storage.documents, []);
});

test("database loads the users schema and persists valid documents", () => {
    const temporaryDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), "flexstore-schema-")
    );
    const dataDirectory = path.join(temporaryDirectory, "data");
    const schemaDirectory = path.join(temporaryDirectory, "schemas");

    try {
        fs.mkdirSync(schemaDirectory);
        fs.copyFileSync(
            path.join(__dirname, "..", "schemas", "users.schema.json"),
            path.join(schemaDirectory, "users.schema.json")
        );

        const users = new Database(dataDirectory, schemaDirectory)
            .collection("users");
        const document = {
            id: 1,
            name: "Test User",
            email: "test@gmail.com",
            age: 20,
            cgpa: 8.82
        };

        assert.deepEqual(users.insert(document), document);
        assert.deepEqual(users.findAll(), [document]);
    } finally {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});
