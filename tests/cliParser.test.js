const assert = require("node:assert/strict");
const test = require("node:test");
const { parseCommand } = require("../cli/cliParser");

test("CLI parser preserves JSON and maps database commands", () => {
    assert.deepEqual(parseCommand('INSERT users {"name":"Arjun","age":21}'), {
        command: "INSERT",
        collection: "users",
        document: { name: "Arjun", age: 21 }
    });
    assert.deepEqual(parseCommand("SHOW DATABASES"), { command: "SHOW_DATABASES" });
    assert.deepEqual(parseCommand("CREATE DATABASE arjun"), {
        command: "CREATE_DATABASE", name: "arjun"
    });
    assert.deepEqual(parseCommand("DROP DATABASE arjun"), {
        command: "DROP_DATABASE", name: "arjun"
    });
    assert.deepEqual(parseCommand("CREATE INDEX users email"), {
        command: "CREATE_INDEX", collection: "users", field: "email"
    });
    assert.deepEqual(parseCommand("DROP INDEX users email"), {
        command: "DROP_INDEX", collection: "users", field: "email"
    });
});

test("CLI parser reports invalid command usage", () => {
    assert.throws(() => parseCommand("USE"), /Usage: USE/);
    assert.throws(() => parseCommand("INSERT users not-json"), /Invalid JSON/);
    assert.throws(() => parseCommand("UNKNOWN"), /Unknown CLI command/);
});